package naeil.dashboard.service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.entity.Brand;
import naeil.dashboard.entity.Orders;
import naeil.dashboard.entity.Product;
import naeil.dashboard.entity.Shop;
import naeil.dashboard.enums.IntegrationType;
import naeil.dashboard.repository.BrandRepository;
import naeil.dashboard.repository.OrdersRepository;
import naeil.dashboard.repository.ProductRepository;
import naeil.dashboard.repository.ShopRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 구글시트('[내일그룹] 데이터 Raw' → [raw]매출관리 탭) 서버 직접 수집(pull).
 * PlayAuto 연동이 끊긴 상태에서 매출 데이터를 시트에서 읽어 orders 테이블에 적재하고
 * DailySalesStats 를 재빌드하여 매출현황 화면에 반영한다.
 *
 * 안전장치:
 *  - 스케줄러 없음. 수동 엔드포인트로만 실행된다(배포 즉시 자동 실행되지 않음).
 *  - 시트에서 만든 주문은 uniq="SHEET-..." 네임스페이스로 구분되어, 재실행 시 기존 시트 주문만 교체한다.
 *  - purgeNonSheet=true 일 때만 PlayAuto 등 비(非)시트 주문을 함께 제거(시트를 단일 진실원본으로).
 *
 * 전제조건: 시트가 '링크가 있는 모든 사용자 - 뷰어'로 공유되어 있어야 서버가 무인증 gviz CSV 를 읽을 수 있다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SheetSalesPullService {

    /** 기본 시트 ID — 필요 시 파라미터로 override 가능 */
    public static final String DEFAULT_SHEET_ID = "196wCXoInO4cBiLCIwYaptXYI4iDP0mzsoBj_7n5ix4g";
    private static final String SALES_TAB = "[raw]매출관리";
    private static final String UNIQ_PREFIX = "SHEET-";
    private static final String SHEET_STATUS = "출고완료"; // 매출 포함 상태
    private static final Pattern DATE = Pattern.compile("(\\d{4})\\.\\s*(\\d{1,2})\\.\\s*(\\d{1,2})");

    private final OrdersRepository ordersRepository;
    private final ShopRepository shopRepository;
    private final BrandRepository brandRepository;
    private final ProductRepository productRepository;
    private final PlayAutoSyncService playAutoSyncService;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(20))
            .build();

    @Transactional
    public Map<String, Object> pull(Long companyId, String sheetId, LocalDate fromDate, boolean purgeNonSheet) {
        String id = (sheetId == null || sheetId.isBlank()) ? DEFAULT_SHEET_ID : extractSheetId(sheetId);
        List<List<String>> csv = fetchCsv(id, SALES_TAB);
        if (csv == null || csv.size() < 2) {
            return Map.of("success", false,
                    "message", "시트에서 매출 데이터를 읽지 못했습니다. 시트 공유설정(링크 열람)과 '[raw]매출관리' 탭을 확인하세요.");
        }

        // 기존 시트 주문 제거(항상). 필요 시 비시트 주문도 제거.
        List<Orders> existing = ordersRepository.findAllByCompanyId(companyId);
        List<Orders> toDelete = new ArrayList<>();
        for (Orders o : existing) {
            boolean isSheet = o.getUniq() != null && o.getUniq().startsWith(UNIQ_PREFIX);
            if (isSheet || purgeNonSheet) {
                toDelete.add(o);
            }
        }
        if (!toDelete.isEmpty()) {
            ordersRepository.deleteAll(toDelete);
            ordersRepository.flush();
        }

        int inserted = 0, skipped = 0;
        long seq = 0;
        Map<String, Integer> byChannel = new LinkedHashMap<>();
        List<Orders> batch = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        // 헤더 행(0) 제외
        for (int i = 1; i < csv.size(); i++) {
            List<String> r = csv.get(i);
            if (r.size() < 12) { skipped++; continue; }
            LocalDate date = parseDate(get(r, 2));
            if (date == null) { skipped++; continue; }
            if (fromDate != null && date.isBefore(fromDate)) { continue; }

            String channel = blank(get(r, 3)) ? "미상" : get(r, 3).trim();
            String prodGroup = blank(get(r, 11)) ? (blank(get(r, 10)) ? "미분류" : get(r, 10).trim()) : get(r, 11).trim();
            BigDecimal pay = money(get(r, 9));         // 총매출액
            if (pay.signum() == 0) pay = money(get(r, 7)); // 실결제금액 fallback
            BigDecimal discount = money(get(r, 6));    // 할인금액
            BigDecimal shipping = money(get(r, 8));    // 배송비

            Shop shop = resolveShop(companyId, channel);
            Brand brand = resolveBrand(companyId, prodGroup);
            Product product = resolveProduct(companyId, brand.getId(), prodGroup);

            Orders o = Orders.builder()
                    .uniq(UNIQ_PREFIX + companyId + "-" + (seq++))
                    .companyId(companyId)
                    .brandId(brand.getId())
                    .shopId(shop.getId())
                    .productId(product.getId())
                    .skuCd(truncate(prodGroup, 100))
                    .grossAmt(pay.add(discount).add(shipping))
                    .discountAmt(discount)
                    .shippingFee(shipping)
                    .payAmt(pay)
                    .orderQuantity(1)
                    .cancelAmt(BigDecimal.ZERO)
                    .ordStatus(SHEET_STATUS)
                    .ordTime(date.atStartOfDay())
                    .payTime(date.atStartOfDay())
                    .wdate(date.atStartOfDay())
                    .createdAt(now)
                    .build();
            batch.add(o);
            byChannel.merge(channel, 1, Integer::sum);
            inserted++;
            if (batch.size() >= 500) { ordersRepository.saveAll(batch); batch.clear(); }
        }
        if (!batch.isEmpty()) ordersRepository.saveAll(batch);
        ordersRepository.flush();

        // 매출현황(daily_sales_stats) 재빌드
        playAutoSyncService.rebuildDailySalesStats(companyId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("insertedOrders", inserted);
        result.put("skippedRows", skipped);
        result.put("deletedExisting", toDelete.size());
        result.put("purgeNonSheet", purgeNonSheet);
        result.put("byChannel", byChannel);
        result.put("message", inserted + "건 적재 후 매출현황 재빌드 완료");
        return result;
    }

    // ---- get-or-create (PlayAutoSyncService 로직 미러링) ----
    private Shop resolveShop(Long companyId, String channel) {
        String code = "SHEET_" + channel;
        code = truncate(code, 60);
        final String shopCode = code;
        return shopRepository.findByCompanyIdAndShopCode(companyId, shopCode)
                .orElseGet(() -> shopRepository.save(Shop.builder()
                        .companyId(companyId)
                        .shopCode(shopCode)
                        .shopName(channel)
                        .platform(IntegrationType.fromShop(channel, shopCode))
                        .build()));
    }

    private Brand resolveBrand(Long companyId, String name) {
        return brandRepository.findByCompanyIdAndBrandName(companyId, name)
                .orElseGet(() -> brandRepository.save(Brand.builder()
                        .companyId(companyId)
                        .brandName(name)
                        .build()));
    }

    private Product resolveProduct(Long companyId, Long brandId, String name) {
        String sku = "SHEET_" + truncate(name, 90);
        return productRepository.findByCompanyIdAndSkuCd(companyId, sku)
                .orElseGet(() -> productRepository.save(Product.builder()
                        .companyId(companyId)
                        .brandId(brandId)
                        .productName(truncate(name, 200))
                        .skuCd(sku)
                        .productPrice(BigDecimal.ZERO)
                        .costPrice(BigDecimal.ZERO)
                        .supplyPrice(BigDecimal.ZERO)
                        .realStock(0)
                        .safeStock(0)
                        .build()));
    }

    // ---- gviz CSV fetch (OfflineSheetPullService 와 동일 방식) ----
    private List<List<String>> fetchCsv(String sheetId, String tabName) {
        try {
            String url = "https://docs.google.com/spreadsheets/d/" + sheetId
                    + "/gviz/tq?tqx=out:csv&sheet=" + URLEncoder.encode(tabName, StandardCharsets.UTF_8);
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(30)).GET().build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() != 200) {
                log.warn("[SheetSalesPull] gviz status {} for tab {}", resp.statusCode(), tabName);
                return null;
            }
            String body = resp.body();
            if (body == null || body.isBlank() || body.stripLeading().startsWith("<")) {
                return null; // 로그인 페이지(HTML) → 공유설정 문제
            }
            return parseCsv(body);
        } catch (Exception e) {
            log.warn("[SheetSalesPull] fetch 실패: {}", e.getMessage());
            return null;
        }
    }

    private static List<List<String>> parseCsv(String text) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder f = new StringBuilder();
        boolean q = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (q) {
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') { f.append('"'); i++; }
                    else q = false;
                } else f.append(c);
            } else {
                if (c == '"') q = true;
                else if (c == ',') { row.add(f.toString()); f.setLength(0); }
                else if (c == '\n') { row.add(f.toString()); rows.add(row); row = new ArrayList<>(); f.setLength(0); }
                else if (c == '\r') { /* skip */ }
                else f.append(c);
            }
        }
        if (f.length() > 0 || !row.isEmpty()) { row.add(f.toString()); rows.add(row); }
        return rows;
    }

    // ---- helpers ----
    private static String get(List<String> r, int i) { return i < r.size() ? r.get(i) : ""; }
    private static boolean blank(String s) { return s == null || s.trim().isEmpty(); }

    private static LocalDate parseDate(String s) {
        if (s == null) return null;
        Matcher m = DATE.matcher(s);
        if (!m.find()) return null;
        try {
            return LocalDate.of(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
        } catch (Exception e) { return null; }
    }

    private static BigDecimal money(String s) {
        if (s == null) return BigDecimal.ZERO;
        String v = s.replaceAll("[^0-9.-]", "");
        if (v.isEmpty() || v.equals("-") || v.equals(".")) return BigDecimal.ZERO;
        try { return new BigDecimal(v).max(BigDecimal.ZERO); } catch (Exception e) { return BigDecimal.ZERO; }
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }

    public static String extractSheetId(String value) {
        if (value == null || value.isBlank()) return DEFAULT_SHEET_ID;
        Matcher m = Pattern.compile("/d/([a-zA-Z0-9_-]{20,})").matcher(value);
        if (m.find()) return m.group(1);
        String v = value.trim();
        return v.matches("[a-zA-Z0-9_-]{20,}") ? v : DEFAULT_SHEET_ID;
    }
}
