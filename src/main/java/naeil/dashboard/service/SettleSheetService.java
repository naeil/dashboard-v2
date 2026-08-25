package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * '내일그룹 월말 정산내역' 구글시트 연동 (Apps Script push, 벌크 배치 처리)
 * ① import-mapping: [기초자료]상품명데이터 → product.brand 매핑 정리
 * ② import-legacy-sales: [raw]매출관리 → 2025년 전체 + 2026년 직연동 미커버 매체만 orders 적재
 * ③ import-outbound: [raw]재고/입고관리 출고 → product_outbound (기존 데이터 미덮어씀)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SettleSheetService {

    private static final Long COMPANY = 1L;
    private static final String CREATED_BY = "SHEET_SYNC";
    private static final LocalDate LEGACY_END = LocalDate.of(2025, 12, 31);

    /** 매체 → [표시 채널명, shop_code] */
    private static final Map<String, String[]> MEDIA_CHANNELS = Map.ofEntries(
            Map.entry("스마트스토어", new String[]{"스마트스토어(하이프리)", "LGC-SS"}),
            Map.entry("스토어팜_국민한상", new String[]{"스마트스토어(국민한상)", "LGC-SS2"}),
            Map.entry("하이프리 아임웹", new String[]{"자사몰", "LGC-IMWEB"}),
            Map.entry("쿠팡", new String[]{"쿠팡", "LGC-CP"}),
            Map.entry("카카오톡 스토어", new String[]{"카카오톡 스토어", "LGC-KAKAO"}),
            Map.entry("지마켓", new String[]{"지마켓", "LGC-GM"}),
            Map.entry("옥션", new String[]{"옥션", "LGC-AU"}),
            Map.entry("11번가", new String[]{"11번가", "LGC-11ST"}),
            Map.entry("NS홈쇼핑", new String[]{"NS홈쇼핑", "LGC-NS"}),
            Map.entry("토스", new String[]{"토스", "LGC-TOSS"}),
            Map.entry("위탁판매", new String[]{"위탁판매", "LGC-CONS"}),
            Map.entry("계좌이체", new String[]{"계좌이체(B2B)", "LGC-BANK"}),
            Map.entry("직접입력", new String[]{"기타(수기)", "LGC-ETC"}),
            Map.entry("오프라인", new String[]{"오프라인(과거)", "OFF-LGC"})
    );

    /** 2026년 이후에도 시트가 유일한 소스인 매체 (직연동 미커버) */
    private static final Set<String> UNCOVERED_MEDIA = Set.of("위탁판매", "계좌이체", "NS홈쇼핑", "토스", "직접입력");

    private final JdbcTemplate jdbcTemplate;
    private final ChannelSyncService channelSyncService;

    /* ───────────────────── ① 상품명 → 브랜드 매핑 ───────────────────── */

    @Transactional
    public Map<String, Object> importMapping(List<Map<String, Object>> rows) {
        Map<String, Long> brandIds = loadOrCreateBrands(rows.stream()
                .map(r -> str(r.get("brand"))).filter(this::notBlank).distinct().toList());

        List<Object[]> updates = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String name = str(row.get("name"));
            String brand = str(row.get("brand"));
            if (!notBlank(name) || !notBlank(brand)) continue;
            Long brandId = brandIds.get(brand);
            if (brandId == null) continue;
            updates.add(new Object[]{brandId, COMPANY, name, brandId});
        }
        int[] results = jdbcTemplate.batchUpdate(
                "UPDATE product SET brand_id = ? WHERE company_id = ? AND TRIM(product_name) = ? AND brand_id <> ?",
                updates);
        int updated = 0;
        for (int r : results) updated += Math.max(r, 0);
        log.info("[SettleSheet] mapping: {} rows, {} products updated", rows.size(), updated);
        return Map.of("success", true, "mappingRows", rows.size(), "productsUpdated", updated,
                "brands", brandIds.size());
    }

    /* ───────────────────── ② 과거 매출 백필 ───────────────────── */

    @Transactional
    public Map<String, Object> importLegacySales(List<Map<String, Object>> rows, boolean replaceLegacy) {
        int deleted = 0;
        if (replaceLegacy) {
            deleted = jdbcTemplate.update(
                    "DELETE FROM orders WHERE company_id = ? AND ord_time < '2026-01-01' AND uniq NOT LIKE 'LGC-%'",
                    COMPANY);
            log.info("[SettleSheet] replaceLegacy: {} pre-2026 orders removed (sheet becomes source of truth)", deleted);
        }

        // 필터링: 2025년 전체 + 2026년 미커버 매체
        record Row(String uniq, LocalDate date, String[] channel, String buyer, String product, long amount, int qty) {}
        List<Row> valid = new ArrayList<>();
        Map<String, Integer> occurrence = new HashMap<>();
        int skipped = 0;
        for (Map<String, Object> r : rows) {
            LocalDate date = parseDate(str(r.get("date")));
            String media = str(r.get("channel"));
            long amount = num(r.get("amount"));
            String product = str(r.get("product"));
            String[] channel = media == null ? null : MEDIA_CHANNELS.get(media);
            boolean inScope = date != null && channel != null && amount > 0 && notBlank(product)
                    && (!date.isAfter(LEGACY_END) || UNCOVERED_MEDIA.contains(media));
            if (!inScope) { skipped++; continue; }
            String buyer = str(r.get("buyer"));
            String baseKey = date + "|" + media + "|" + (buyer == null ? "" : buyer) + "|" + product + "|" + amount;
            int occ = occurrence.merge(baseKey, 1, Integer::sum);
            String uniq = "LGC-" + sha1(baseKey + "#" + occ).substring(0, 24);
            valid.add(new Row(uniq, date, channel, buyer, product, amount, (int) Math.max(1, num(r.get("qty")))));
        }

        // 상점/상품 일괄 확보
        Map<String, Long> shops = new HashMap<>();
        for (Row row : valid) {
            shops.computeIfAbsent(row.channel()[1], code -> ensureShop(code, row.channel()[0]));
        }
        Map<String, long[]> productMap = ensureProducts(valid.stream().map(Row::product).distinct().toList());

        // orders 배치 upsert
        List<Object[]> batch = new ArrayList<>();
        for (Row row : valid) {
            long[] prod = productMap.get(row.product());
            Timestamp ts = Timestamp.valueOf(row.date().atTime(12, 0));
            batch.add(new Object[]{
                    row.uniq(), COMPANY, prod[1], shops.get(row.channel()[1]), prod[0],
                    "LGC-" + prod[0], row.amount(), row.amount(), row.qty(), "출고완료",
                    ts, ts, ts
            });
        }
        jdbcTemplate.batchUpdate("""
                INSERT INTO orders (uniq, company_id, brand_id, shop_id, product_id, sku_cd,
                                    gross_amt, pay_amt, order_quantity, ord_status, ord_time, wdate, pay_time)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT (uniq) DO UPDATE SET
                    pay_amt = EXCLUDED.pay_amt, gross_amt = EXCLUDED.gross_amt,
                    order_quantity = EXCLUDED.order_quantity, ord_time = EXCLUDED.ord_time,
                    shop_id = EXCLUDED.shop_id, product_id = EXCLUDED.product_id
                """, batch);

        // 일별/월별 실적 재계산 (채널×스냅샷 교체)
        Map<String, TreeMap<LocalDate, long[]>> daily = new HashMap<>();
        for (Row row : valid) {
            daily.computeIfAbsent(row.channel()[0], k -> new TreeMap<>())
                    .merge(row.date(), new long[]{row.amount(), 1}, (a, b) -> new long[]{a[0] + b[0], a[1] + b[1]});
        }
        for (Map.Entry<String, TreeMap<LocalDate, long[]>> e : daily.entrySet()) {
            String channelName = e.getKey();
            jdbcTemplate.update(
                    "DELETE FROM field_sales_entry WHERE company_id = ? AND channel_name = ? AND created_by = ? AND entry_date <= ?",
                    COMPANY, channelName, CREATED_BY, java.sql.Date.valueOf(LEGACY_END.plusYears(10)));
            List<Object[]> dailyBatch = new ArrayList<>();
            Map<YearMonth, long[]> monthly = new TreeMap<>();
            for (Map.Entry<LocalDate, long[]> d : e.getValue().entrySet()) {
                dailyBatch.add(new Object[]{COMPANY, channelName, java.sql.Date.valueOf(d.getKey()),
                        (int) d.getValue()[1], d.getValue()[0], "정산시트 매출 백필 (" + d.getValue()[1] + "건)", CREATED_BY});
                monthly.merge(YearMonth.from(d.getKey()), new long[]{d.getValue()[0], d.getValue()[1]},
                        (a, b) -> new long[]{a[0] + b[0], a[1] + b[1]});
            }
            jdbcTemplate.batchUpdate(
                    "INSERT INTO field_sales_entry (company_id, channel_name, entry_date, quantity, sales_amount, memo, created_by) VALUES (?,?,?,?,?,?,?)",
                    dailyBatch);
            for (Map.Entry<YearMonth, long[]> m : monthly.entrySet()) {
                channelSyncService.saveOrUpdateChannelPerformance(
                        channelName, m.getKey().toString(), m.getValue()[0], (int) m.getValue()[1], "SETTLE_SHEET");
                upsertExecutivePerformance(channelName, m.getKey(), m.getValue()[0], (int) m.getValue()[1]);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("ingested", valid.size());
        result.put("skipped", skipped);
        result.put("legacyDeleted", deleted);
        result.put("channels", daily.keySet());
        log.info("[SettleSheet] legacy sales: ingested={}, skipped={}, deleted={}", valid.size(), skipped, deleted);
        return result;
    }

    /* ───────────────────── ③ 출고 데이터 ───────────────────── */

    @Transactional
    public Map<String, Object> importOutbound(List<Map<String, Object>> rows) {
        List<Map<String, Object>> allProducts = jdbcTemplate.queryForList(
                "SELECT id, brand_id, product_name FROM product WHERE company_id = ?", COMPANY);
        Map<String, long[]> byNorm = new HashMap<>();
        for (Map<String, Object> p : allProducts) {
            byNorm.putIfAbsent(norm(String.valueOf(p.get("product_name"))),
                    new long[]{((Number) p.get("id")).longValue(), ((Number) p.get("brand_id")).longValue()});
        }

        Map<String, long[]> agg = new LinkedHashMap<>(); // productId|date -> [qty, brandId]
        Set<String> unmatched = new HashSet<>();
        int matchedRows = 0;
        for (Map<String, Object> r : rows) {
            LocalDate date = parseDate(str(r.get("date")));
            long qty = num(r.get("qty"));
            if (date == null || qty <= 0) continue;
            long[] prod = matchProduct(byNorm, str(r.get("sku")), str(r.get("online")));
            if (prod == null) {
                if (unmatched.size() < 30) unmatched.add(String.valueOf(str(r.get("sku"))));
                continue;
            }
            matchedRows++;
            agg.merge(prod[0] + "|" + date, new long[]{qty, prod[1]}, (a, b) -> new long[]{a[0] + b[0], a[1]});
        }

        List<Object[]> batch = new ArrayList<>();
        for (Map.Entry<String, long[]> e : agg.entrySet()) {
            String[] key = e.getKey().split("\\|");
            batch.add(new Object[]{COMPANY, Long.parseLong(key[0]), e.getValue()[1],
                    java.sql.Date.valueOf(key[1]), (int) e.getValue()[0]});
        }
        int[] results = jdbcTemplate.batchUpdate("""
                INSERT INTO product_outbound (company_id, product_id, brand_id, outbound_date, outbound_count)
                VALUES (?,?,?,?,?)
                ON CONFLICT (company_id, product_id, outbound_date) DO NOTHING
                """, batch);
        int inserted = 0;
        for (int r : results) if (r > 0) inserted++;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("rowsMatched", matchedRows);
        result.put("daysInserted", inserted);
        result.put("daysAlreadyPresent", batch.size() - inserted);
        result.put("unmatchedSample", unmatched);
        log.info("[SettleSheet] outbound: matched={}, inserted={}, unmatched={}", matchedRows, inserted, unmatched.size());
        return result;
    }

    /* ───────────────────── 내부 유틸 ───────────────────── */

    private long[] matchProduct(Map<String, long[]> byNorm, String sku, String online) {
        for (String candidate : new String[]{sku, online}) {
            if (!notBlank(candidate)) continue;
            long[] hit = byNorm.get(norm(candidate));
            if (hit != null) return hit;
        }
        // 부분 일치 (짧은 쪽이 긴 쪽에 포함)
        String target = notBlank(sku) ? norm(sku) : (notBlank(online) ? norm(online) : null);
        if (target == null || target.length() < 4) return null;
        for (Map.Entry<String, long[]> e : byNorm.entrySet()) {
            if (e.getKey().contains(target) || target.contains(e.getKey())) return e.getValue();
        }
        return null;
    }

    private Map<String, Long> loadOrCreateBrands(List<String> names) {
        Map<String, Long> map = new HashMap<>();
        for (Map<String, Object> row : jdbcTemplate.queryForList(
                "SELECT id, brand_name FROM brand WHERE company_id = ?", COMPANY)) {
            map.put(String.valueOf(row.get("brand_name")).trim(), ((Number) row.get("id")).longValue());
        }
        for (String name : names) {
            if (map.containsKey(name)) continue;
            jdbcTemplate.update("INSERT INTO brand (company_id, brand_name) VALUES (?, ?)", COMPANY, name);
            Long id = jdbcTemplate.queryForObject(
                    "SELECT id FROM brand WHERE company_id = ? AND brand_name = ? ORDER BY id DESC LIMIT 1",
                    Long.class, COMPANY, name);
            map.put(name, id);
        }
        return map;
    }

    private Long ensureShop(String code, String name) {
        List<Long> ids = jdbcTemplate.queryForList(
                "SELECT id FROM shop WHERE shop_code = ? LIMIT 1", Long.class, code);
        if (!ids.isEmpty()) return ids.get(0);
        jdbcTemplate.update("INSERT INTO shop (company_id, shop_name, shop_code, platform, created_at) VALUES (?, ?, ?, 'OTHER', NOW())",
                COMPANY, name, code);
        return jdbcTemplate.queryForObject(
                "SELECT id FROM shop WHERE shop_code = ? ORDER BY id DESC LIMIT 1", Long.class, code);
    }

    /** name -> [productId, brandId], 없으면 생성 */
    private Map<String, long[]> ensureProducts(List<String> names) {
        Map<String, long[]> map = new HashMap<>();
        Map<String, long[]> byNorm = new HashMap<>();
        for (Map<String, Object> p : jdbcTemplate.queryForList(
                "SELECT id, brand_id, product_name FROM product WHERE company_id = ?", COMPANY)) {
            long[] v = new long[]{((Number) p.get("id")).longValue(), ((Number) p.get("brand_id")).longValue()};
            byNorm.putIfAbsent(norm(String.valueOf(p.get("product_name"))), v);
        }
        Long defaultBrand = null;
        for (String name : names) {
            long[] hit = byNorm.get(norm(name));
            if (hit != null) { map.put(name, hit); continue; }
            if (defaultBrand == null) defaultBrand = ensureDefaultBrand();
            jdbcTemplate.update(
                    "INSERT INTO product (company_id, brand_id, product_name) VALUES (?, ?, ?)",
                    COMPANY, defaultBrand, name);
            Long id = jdbcTemplate.queryForObject(
                    "SELECT id FROM product WHERE company_id = ? AND product_name = ? ORDER BY id DESC LIMIT 1",
                    Long.class, COMPANY, name);
            long[] v = new long[]{id, defaultBrand};
            map.put(name, v);
            byNorm.put(norm(name), v);
        }
        return map;
    }

    private Long ensureDefaultBrand() {
        List<Long> ids = jdbcTemplate.queryForList(
                "SELECT id FROM brand WHERE company_id = ? AND brand_name = '미분류' LIMIT 1", Long.class, COMPANY);
        if (!ids.isEmpty()) return ids.get(0);
        List<Long> any = jdbcTemplate.queryForList(
                "SELECT id FROM brand WHERE company_id = ? ORDER BY id LIMIT 1", Long.class, COMPANY);
        if (!any.isEmpty()) return any.get(0);
        jdbcTemplate.update("INSERT INTO brand (company_id, brand_name) VALUES (?, '미분류')", COMPANY);
        return jdbcTemplate.queryForObject(
                "SELECT id FROM brand WHERE company_id = ? AND brand_name = '미분류' LIMIT 1", Long.class, COMPANY);
    }

    private void upsertExecutivePerformance(String channelName, YearMonth ym, long total, int orders) {
        java.sql.Date reportMonth = java.sql.Date.valueOf(ym.atDay(1));
        long avg = orders > 0 ? total / orders : 0L;
        int updated = jdbcTemplate.update(
                "UPDATE executive_channel_performance SET sales_amount = ?, order_count = ?, average_order_value = ?, source_type = 'DIRECT_API' " +
                        "WHERE company_id = ? AND channel_name = ? AND report_month = ?",
                total, orders, avg, COMPANY, channelName, reportMonth);
        if (updated == 0) {
            jdbcTemplate.update(
                    "INSERT INTO executive_channel_performance (company_id, channel_name, sales_amount, order_count, average_order_value, report_month, source_type) " +
                            "VALUES (?, ?, ?, ?, ?, ?, 'DIRECT_API')",
                    COMPANY, channelName, total, orders, avg, reportMonth);
        }
    }

    private static String norm(String value) {
        if (value == null) return "";
        return value.toLowerCase().replaceAll("[^0-9a-z가-힣]", "");
    }

    private boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static LocalDate parseDate(String value) {
        if (value == null) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("(20\\d{2})[.\\-/\\s]+(\\d{1,2})[.\\-/\\s]+(\\d{1,2})").matcher(value);
        if (!m.find()) {
            String digits = value.replaceAll("[^0-9]", "");
            if (digits.length() == 8) {
                try {
                    return LocalDate.of(Integer.parseInt(digits.substring(0, 4)),
                            Integer.parseInt(digits.substring(4, 6)), Integer.parseInt(digits.substring(6, 8)));
                } catch (Exception e) { return null; }
            }
            return null;
        }
        try {
            return LocalDate.of(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
        } catch (Exception e) {
            return null;
        }
    }

    private static String str(Object value) {
        if (value == null) return null;
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    private static long num(Object value) {
        if (value == null) return 0L;
        try {
            return new BigDecimal(String.valueOf(value).replaceAll("[₩,\\s원]", "")).longValue();
        } catch (Exception e) {
            return 0L;
        }
    }

    private static String sha1(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                String h = Integer.toHexString(0xff & b);
                if (h.length() == 1) sb.append('0');
                sb.append(h);
            }
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(input.hashCode());
        }
    }
}
