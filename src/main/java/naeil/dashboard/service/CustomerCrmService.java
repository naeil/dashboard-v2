package naeil.dashboard.service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 고객 구매 데이터 기반 마케팅(CRM) 엔진.
 * '[내일그룹] 데이터 Raw' → [raw]매출관리 탭을 서버에서 직접 읽어, 구매자 단위로 집계한다.
 *  - 구매자 컬럼(이름/전화/주문일/금액/채널/상품)을 "헤더 이름"으로 자동 탐지 → 시트 컬럼 위치가 바뀌어도 동작.
 *  - 마스킹(김**, 010-****-1234) 여부를 스스로 진단해서 신뢰도를 함께 반환(식별 불가하면 솔직히 표시).
 *  - 고객별 구매횟수/주기/다음 예상 구매일을 계산 → 실무진이 바로 실행할 "오늘 쏠 대상" 액션 리스트 생성.
 *  - AI 불필요(규칙 기반). 결제 없이 작동.
 */
@Slf4j
@Service
public class CustomerCrmService {

    public static final String DEFAULT_SHEET_ID = "196wCXoInO4cBiLCIwYaptXYI4iDP0mzsoBj_7n5ix4g";
    private static final String SALES_TAB = "[raw]매출관리";
    private static final Pattern DATE = Pattern.compile("(\\d{4})\\.\\s*(\\d{1,2})\\.\\s*(\\d{1,2})");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(20))
            .build();

    /* 헤더 매칭 키워드 (소문자/공백제거 후 contains) */
    private static final String[] KW_NAME = {"주문자", "구매자", "수취인", "수령인", "받는", "고객명", "성명", "회원명", "이름"};
    private static final String[] KW_PHONE = {"전화", "연락처", "휴대폰", "핸드폰", "수취인연락처", "주문자연락처", "phone", "tel", "hp", "mobile"};
    private static final String[] KW_ORDERNO = {"주문번호", "주문코드", "ordercode", "orderno", "주문no"};
    private static final String[] KW_DATE = {"주문일", "결제일", "출고일", "일자", "날짜", "주문일시", "결제일시"};
    private static final String[] KW_AMOUNT = {"총매출", "결제금액", "실결제", "판매금액", "주문금액", "매출"};
    private static final String[] KW_PRODUCT = {"상품명", "제품명", "상품", "제품", "품목", "상품그룹"};
    private static final String[] KW_CHANNEL = {"채널", "판매처", "쇼핑몰", "마켓", "스토어", "판매채널"};

    public Map<String, Object> analyze(Long companyId, String sheetIdRaw) {
        String sheetId = (sheetIdRaw == null || sheetIdRaw.isBlank()) ? DEFAULT_SHEET_ID : extractSheetId(sheetIdRaw);
        List<List<String>> csv = fetchCsv(sheetId, SALES_TAB);
        if (csv == null || csv.size() < 2) {
            return Map.of("success", false,
                    "message", "시트에서 데이터를 읽지 못했습니다. 공유설정(링크 열람)과 '[raw]매출관리' 탭을 확인하세요.");
        }

        List<String> header = csv.get(0);
        // 알려진 기본 인덱스(매출 수집기 기준): 날짜=2, 채널=3, 금액=9, 상품=11. 헤더 탐지 실패 시 fallback.
        int idxName = findCol(header, KW_NAME, -1);
        int idxPhone = findCol(header, KW_PHONE, -1);
        int idxOrderNo = findCol(header, KW_ORDERNO, -1);
        int idxDate = findCol(header, KW_DATE, 2);
        int idxAmount = findCol(header, KW_AMOUNT, 9);
        int idxProduct = findCol(header, KW_PRODUCT, 11);
        int idxChannel = findCol(header, KW_CHANNEL, 3);

        // 고객 식별이 불가능하면(이름·전화·주문자 식별자 아무것도 없음) 2번 기능은 성립 불가 → 솔직히 반환
        if (idxName < 0 && idxPhone < 0) {
            Map<String, Object> out = baseHealth(header, csv, idxName, idxPhone, idxOrderNo, idxDate, idxAmount, idxProduct, idxChannel);
            out.put("success", false);
            out.put("message", "이 탭에 '구매자 이름/전화' 컬럼이 없어 고객 단위 분석이 불가합니다. 아래 감지된 헤더를 확인하세요.");
            return out;
        }

        // ── 구매자별 집계 ──
        Map<String, Cust> custs = new LinkedHashMap<>();
        int usedRows = 0, unidentifiable = 0, maskedPhoneCount = 0, maskedNameCount = 0, totalRows = 0;
        for (int i = 1; i < csv.size(); i++) {
            List<String> r = csv.get(i);
            LocalDate date = parseDate(get(r, idxDate));
            if (date == null) continue;
            totalRows++;

            String name = idxName >= 0 ? get(r, idxName).trim() : "";
            String phoneRaw = idxPhone >= 0 ? get(r, idxPhone).trim() : "";
            String phoneDigits = phoneRaw.replaceAll("[^0-9]", "");
            boolean phoneMasked = phoneRaw.contains("*") || phoneRaw.contains("○") || phoneRaw.contains("ㅇ");
            boolean nameMasked = name.contains("*") || name.contains("○") || name.contains("ㅇㅇ");
            if (phoneMasked) maskedPhoneCount++;
            if (nameMasked) maskedNameCount++;

            // 식별키: 전화(숫자 10자리+) 우선 → 이름+전화 → 이름
            String key;
            if (phoneDigits.length() >= 9 && !phoneMasked) {
                key = "P:" + phoneDigits;
            } else if (!name.isEmpty() && !nameMasked) {
                key = "N:" + name + "|" + phoneDigits;
            } else {
                unidentifiable++;
                continue; // 같은 사람인지 식별 불가 → 재구매 집계에서 제외
            }

            double amt = money(get(r, idxAmount));
            String channel = idxChannel >= 0 && !blank(get(r, idxChannel)) ? get(r, idxChannel).trim() : "미상";
            String product = idxProduct >= 0 && !blank(get(r, idxProduct)) ? get(r, idxProduct).trim() : "";

            Cust c = custs.computeIfAbsent(key, k -> new Cust());
            c.key = key;
            if (c.name.isEmpty() && !name.isEmpty()) c.name = name;
            if (c.phone.isEmpty() && !phoneRaw.isEmpty()) c.phone = phoneRaw;
            c.orderCount++;
            c.totalAmount += amt;
            c.lastChannel = channel;
            if (!product.isEmpty()) c.lastProduct = product;
            if (c.firstOrder == null || date.isBefore(c.firstOrder)) c.firstOrder = date;
            if (c.lastOrder == null || date.isAfter(c.lastOrder)) c.lastOrder = date;
            usedRows++;
        }

        LocalDate today = LocalDate.now();
        int totalCustomers = custs.size();
        int repeat = 0, loyal = 0, atRisk = 0, dueSoon = 0, newbie = 0;
        List<Map<String, Object>> actions = new ArrayList<>();

        for (Cust c : custs.values()) {
            int n = c.orderCount;
            long daysSinceLast = ChronoUnit.DAYS.between(c.lastOrder, today);
            Long avgInterval = null;
            LocalDate predictedNext = null;
            Long daysUntilNext = null;
            if (n >= 2 && c.firstOrder != null && !c.firstOrder.equals(c.lastOrder)) {
                long span = ChronoUnit.DAYS.between(c.firstOrder, c.lastOrder);
                avgInterval = Math.max(1, span / (n - 1));
                predictedNext = c.lastOrder.plusDays(avgInterval);
                daysUntilNext = ChronoUnit.DAYS.between(today, predictedNext);
            }
            if (n >= 2) repeat++;
            if (n >= 4) loyal++;
            if (n == 1 && daysSinceLast <= 30) newbie++;

            String segment;
            String reason;
            if (avgInterval != null && daysUntilNext != null && daysUntilNext >= -3 && daysUntilNext <= 7) {
                segment = "구매임박";
                dueSoon++;
                reason = "평균 " + avgInterval + "일 주기 → 다음 구매 예상 " + predictedNext + " (D" + (daysUntilNext >= 0 ? "-" + daysUntilNext : "+" + (-daysUntilNext)) + ")";
            } else if (avgInterval != null && daysSinceLast > Math.round(avgInterval * 1.8)) {
                segment = "이탈위험";
                atRisk++;
                reason = "평균 " + avgInterval + "일 주기인데 " + daysSinceLast + "일째 재구매 없음";
            } else if (n == 1 && daysSinceLast >= 7 && daysSinceLast <= 30) {
                segment = "첫구매(재구매 유도)";
                reason = "첫 구매 후 " + daysSinceLast + "일 경과 — 두 번째 구매 전환 타이밍";
            } else if (n >= 4) {
                segment = "충성고객";
                reason = "누적 " + n + "회 구매";
            } else if (n >= 2) {
                segment = "재구매고객";
                reason = "누적 " + n + "회 구매";
            } else {
                segment = "신규";
                reason = "첫 구매";
            }

            // 실무 액션 대상: 구매임박 / 이탈위험 / 첫구매 유도
            if (segment.equals("구매임박") || segment.equals("이탈위험") || segment.equals("첫구매(재구매 유도)")) {
                Map<String, Object> a = new LinkedHashMap<>();
                a.put("customer", c.displayName());
                a.put("phone", c.phone);
                a.put("nthPurchase", n);
                a.put("lastOrder", c.lastOrder == null ? "" : c.lastOrder.toString());
                a.put("predictedNext", predictedNext == null ? "" : predictedNext.toString());
                a.put("daysUntilNext", daysUntilNext);
                a.put("segment", segment);
                a.put("reason", reason);
                a.put("totalAmount", Math.round(c.totalAmount));
                a.put("lastProduct", c.lastProduct);
                a.put("channel", c.lastChannel);
                a.put("benefit", benefitFor(n, segment));
                a.put("howTo", howToReach(c.lastChannel));
                a.put("priority", priorityOf(segment, daysUntilNext, daysSinceLast));
                actions.add(a);
            }
        }

        actions.sort(Comparator.comparingInt((Map<String, Object> m) -> (int) m.get("priority")).reversed());
        List<Map<String, Object>> topActions = actions.size() > 200 ? actions.subList(0, 200) : actions;

        // ── 결과 ──
        Map<String, Object> out = baseHealth(header, csv, idxName, idxPhone, idxOrderNo, idxDate, idxAmount, idxProduct, idxChannel);
        out.put("success", true);

        Map<String, Object> health = castMap(out.get("dataHealth"));
        health.put("totalDataRows", totalRows);
        health.put("identifiedRows", usedRows);
        health.put("unidentifiableRows", unidentifiable);
        health.put("maskedPhoneRows", maskedPhoneCount);
        health.put("maskedNameRows", maskedNameCount);
        boolean phoneUsable = idxPhone >= 0 && maskedPhoneCount < totalRows * 0.5;
        health.put("identityReliable", phoneUsable || (idxName >= 0 && maskedNameCount < totalRows * 0.5));
        health.put("identityBasis", phoneUsable ? "전화번호" : (idxName >= 0 ? "이름(+전화 일부)" : "없음"));

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalCustomers", totalCustomers);
        summary.put("repeatCustomers", repeat);
        summary.put("repeatRate", totalCustomers == 0 ? 0 : Math.round(repeat * 1000.0 / totalCustomers) / 10.0);
        summary.put("loyalCustomers", loyal);
        summary.put("atRiskCustomers", atRisk);
        summary.put("dueSoonCustomers", dueSoon);
        summary.put("newCustomers", newbie);
        summary.put("actionCount", actions.size());
        out.put("summary", summary);
        out.put("actions", topActions);
        return out;
    }

    private int priorityOf(String segment, Long daysUntilNext, long daysSinceLast) {
        switch (segment) {
            case "구매임박":
                return 1000 - (daysUntilNext == null ? 0 : (int) Math.abs(daysUntilNext));
            case "이탈위험":
                return 800 - (int) Math.min(daysSinceLast, 700);
            case "첫구매(재구매 유도)":
                return 500 - (int) Math.min(daysSinceLast, 400);
            default:
                return 0;
        }
    }

    private String benefitFor(int n, String segment) {
        if (segment.equals("이탈위험")) return "컴백 쿠폰(한시) + 인기상품 추천";
        if (segment.equals("첫구매(재구매 유도)")) return "두 번째 구매 웰컴 쿠폰";
        if (n >= 4) return "VIP 사은품/등급 혜택 + 신상품 우선 안내";
        if (n >= 2) return "재구매 등급 할인";
        return "웰컴 쿠폰";
    }

    private String howToReach(String channel) {
        if (channel == null) return "채널 쿠폰/알림";
        String c = channel.toLowerCase();
        if (channel.contains("쿠팡") || c.contains("coupang")) return "쿠팡 판매자쿠폰 발행 / 아이템 쿠폰";
        if (channel.contains("스마트") || channel.contains("네이버") || c.contains("smart")) return "스마트스토어 톡톡 메시지 / 고객등급 쿠폰";
        if (channel.contains("아임웹") || c.contains("imweb")) return "아임웹 회원 쿠폰/문자 발송";
        if (channel.contains("카카오")) return "카카오톡스토어 쿠폰/알림톡";
        return "해당 채널 쿠폰/알림 발송";
    }

    private Map<String, Object> baseHealth(List<String> header, List<List<String>> csv, int idxName, int idxPhone,
                                           int idxOrderNo, int idxDate, int idxAmount, int idxProduct, int idxChannel) {
        Map<String, Object> dataHealth = new LinkedHashMap<>();
        dataHealth.put("header", header);
        Map<String, Object> detected = new LinkedHashMap<>();
        detected.put("name", colInfo(header, idxName));
        detected.put("phone", colInfo(header, idxPhone));
        detected.put("orderNo", colInfo(header, idxOrderNo));
        detected.put("date", colInfo(header, idxDate));
        detected.put("amount", colInfo(header, idxAmount));
        detected.put("product", colInfo(header, idxProduct));
        detected.put("channel", colInfo(header, idxChannel));
        dataHealth.put("detectedColumns", detected);
        List<List<String>> samples = new ArrayList<>();
        for (int i = 1; i < csv.size() && i <= 2; i++) samples.add(csv.get(i));
        dataHealth.put("sampleRows", samples);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("dataHealth", dataHealth);
        return out;
    }

    private Map<String, Object> colInfo(List<String> header, int idx) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("index", idx);
        m.put("headerName", idx >= 0 && idx < header.size() ? header.get(idx) : null);
        return m;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Object o) {
        return (Map<String, Object>) o;
    }

    /* ── 구매자 누적 ── */
    private static class Cust {
        String key = "";
        String name = "";
        String phone = "";
        int orderCount = 0;
        double totalAmount = 0;
        LocalDate firstOrder;
        LocalDate lastOrder;
        String lastChannel = "미상";
        String lastProduct = "";

        String displayName() {
            if (!name.isEmpty()) return name + (phone.isEmpty() ? "" : " (" + phone + ")");
            return phone.isEmpty() ? "고객" : phone;
        }
    }

    /* ── 헤더 탐지 ── */
    private int findCol(List<String> header, String[] keywords, int fallback) {
        for (int i = 0; i < header.size(); i++) {
            String h = norm(header.get(i));
            if (h.isEmpty()) continue;
            for (String kw : keywords) {
                if (h.contains(norm(kw))) return i;
            }
        }
        return fallback;
    }

    private static String norm(String s) {
        return s == null ? "" : s.toLowerCase().replaceAll("[\\s_\\-()\\[\\]]", "");
    }

    /* ── gviz CSV fetch (SheetSalesPullService 와 동일) ── */
    private List<List<String>> fetchCsv(String sheetId, String tabName) {
        try {
            String url = "https://docs.google.com/spreadsheets/d/" + sheetId
                    + "/gviz/tq?tqx=out:csv&sheet=" + URLEncoder.encode(tabName, StandardCharsets.UTF_8);
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(30)).GET().build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() != 200) {
                log.warn("[CustomerCrm] gviz status {} for tab {}", resp.statusCode(), tabName);
                return null;
            }
            String body = resp.body();
            if (body == null || body.isBlank() || body.stripLeading().startsWith("<")) return null;
            return parseCsv(body);
        } catch (Exception e) {
            log.warn("[CustomerCrm] fetch 실패: {}", e.getMessage());
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

    private static String get(List<String> r, int i) { return i >= 0 && i < r.size() ? r.get(i) : ""; }
    private static boolean blank(String s) { return s == null || s.trim().isEmpty(); }

    private static LocalDate parseDate(String s) {
        if (s == null) return null;
        Matcher m = DATE.matcher(s);
        if (!m.find()) return null;
        try {
            return LocalDate.of(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
        } catch (Exception e) { return null; }
    }

    private static double money(String s) {
        if (s == null) return 0;
        String v = s.replaceAll("[^0-9.-]", "");
        if (v.isEmpty() || v.equals("-") || v.equals(".")) return 0;
        try { return Math.max(0, Double.parseDouble(v)); } catch (Exception e) { return 0; }
    }

    public static String extractSheetId(String value) {
        if (value == null || value.isBlank()) return DEFAULT_SHEET_ID;
        Matcher m = Pattern.compile("/d/([a-zA-Z0-9_-]{20,})").matcher(value);
        if (m.find()) return m.group(1);
        String v = value.trim();
        return v.matches("[a-zA-Z0-9_-]{20,}") ? v : DEFAULT_SHEET_ID;
    }
}
