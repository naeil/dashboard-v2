package naeil.dashboard.service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.repository.ChannelApiCredentialRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * 오프라인 발주 구글시트 서버 직접 수집(pull).
 * 기존 Apps Script push 방식을 대체 — 시트가 "링크가 있는 사용자 열람" 상태면
 * gviz CSV export 를 무인증으로 읽어 탭별로 정규화 후 OfflineSheetService.importRows 로 적재한다.
 * 시트 ID(또는 URL)는 channel_api_credential(OFFLINE_SHEET).credentialKey2 에 저장한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OfflineSheetPullService {

    private static final String CREDENTIAL_TYPE = "OFFLINE_SHEET";
    private static final Pattern SHEET_ID = Pattern.compile("/d/([a-zA-Z0-9_-]{20,})");
    private static final Pattern DATE8 = Pattern.compile("^\\d{8}$");
    private static final Pattern ORDER_NO = Pattern.compile("^\\d{10,}$");

    /** 탭별 후보 시트명 — 이름이 살짝 바뀌어도 잡히도록 후보 순서대로 시도 */
    private static final Map<String, List<String>> TAB_CANDIDATES = new LinkedHashMap<>() {{
        put("스토어", List.of("스토어"));
        put("연구소", List.of("연구소"));
        put("초이스", List.of("초이스"));
        put("제로데이", List.of("제로데이(신규업체)", "제로데이"));
        put("냉장고", List.of("냉장고"));
    }};

    private final OfflineSheetService offlineSheetService;
    private final ChannelApiCredentialRepository credentialRepo;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(20))
            .build();

    /** 매일 22:05 자동 수집 (일일보고·주간요약 배치보다 앞) */
    @Scheduled(cron = "0 5 22 * * *", zone = "Asia/Seoul")
    public void pullAuto() {
        try {
            Map<String, Object> result = pull();
            log.info("[OfflineSheetPull] auto: {}", result);
        } catch (Exception e) {
            log.warn("[OfflineSheetPull] auto 실패: {}", e.getMessage());
        }
    }

    public Map<String, Object> pull() {
        String sheetId = resolveSheetId();
        if (sheetId == null) {
            return Map.of("success", false,
                    "message", "시트 링크가 설정되지 않았습니다. 채널 연동 설정에서 오프라인 발주 시트 링크를 저장하세요.");
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, Object> tabInfo = new LinkedHashMap<>();
        int undated = 0;
        for (Map.Entry<String, List<String>> entry : TAB_CANDIDATES.entrySet()) {
            String tab = entry.getKey();
            List<List<String>> csv = null;
            String usedName = null;
            for (String candidate : entry.getValue()) {
                csv = fetchCsv(sheetId, candidate);
                if (csv != null) { usedName = candidate; break; }
            }
            if (csv == null) {
                tabInfo.put(tab, "탭 없음");
                continue;
            }
            int before = rows.size();
            int skippedNoDate = normalizeTab(tab, csv, rows);
            undated += skippedNoDate;
            tabInfo.put(tab, (rows.size() - before) + "행" + (skippedNoDate > 0 ? " (날짜 없음 " + skippedNoDate + "행 제외)" : "")
                    + ("스토어".equals(tab) || usedName.equals(tab) ? "" : " [" + usedName + "]"));
        }
        if (rows.isEmpty()) {
            Map<String, Object> fail = new LinkedHashMap<>();
            fail.put("success", false);
            fail.put("message", "시트에서 수집할 행이 없습니다. 시트 공유 설정(링크 열람)과 탭 구조를 확인하세요.");
            fail.put("tabs", tabInfo);
            return fail;
        }
        Map<String, Object> result = new LinkedHashMap<>(offlineSheetService.importRows(rows));
        result.put("tabs", tabInfo);
        if (undated > 0) {
            result.put("warning", "주문일자가 없는 " + undated + "행은 수집하지 못했습니다 (초이스 탭 등 — 시트에 날짜 열 필요).");
        }
        return result;
    }

    public String resolveSheetId() {
        return credentialRepo.findByChannelType(CREDENTIAL_TYPE)
                .map(c -> extractSheetId(c.getCredentialKey2()))
                .orElse(null);
    }

    public static String extractSheetId(String value) {
        if (value == null || value.isBlank()) return null;
        Matcher m = SHEET_ID.matcher(value);
        if (m.find()) return m.group(1);
        String v = value.trim();
        return v.matches("[a-zA-Z0-9_-]{20,}") ? v : null;
    }

    /* ───────── 시트 읽기 ───────── */

    private List<List<String>> fetchCsv(String sheetId, String tabName) {
        try {
            String url = "https://docs.google.com/spreadsheets/d/" + sheetId
                    + "/gviz/tq?tqx=out:csv&sheet=" + URLEncoder.encode(tabName, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(30)).GET().build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String body = response.body();
            if (response.statusCode() != 200 || body == null || body.startsWith("<") || body.contains("<html")) {
                return null; // 탭 없음 / 권한 없음 / 오류 페이지
            }
            return parseCsv(body);
        } catch (Exception e) {
            log.warn("[OfflineSheetPull] {} 탭 읽기 실패: {}", tabName, e.getMessage());
            return null;
        }
    }

    static List<List<String>> parseCsv(String text) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') { cur.append('"'); i++; }
                    else quoted = false;
                } else cur.append(c);
            } else {
                if (c == '"') quoted = true;
                else if (c == ',') { row.add(cur.toString()); cur.setLength(0); }
                else if (c == '\n') { row.add(cur.toString()); rows.add(row); row = new ArrayList<>(); cur.setLength(0); }
                else if (c != '\r') cur.append(c);
            }
        }
        if (cur.length() > 0 || !row.isEmpty()) { row.add(cur.toString()); rows.add(row); }
        return rows;
    }

    /* ───────── 탭별 정규화 (2026-08 시트 레이아웃 기준) ───────── */

    private int normalizeTab(String tab, List<List<String>> csv, List<Map<String, Object>> out) {
        int undated = 0;
        for (List<String> r : csv) {
            switch (tab) {
                case "스토어" -> {
                    // [번호, 주문번호, 거래처, 휴대전화, 우편번호, 주소, 품목코드, 품명, 규격, 주문일자, 메세지, 주문량, 금액]
                    if (!ORDER_NO.matcher(cell(r, 1)).matches() || !DATE8.matcher(cell(r, 9)).matches()) continue;
                    if (cell(r, 7).isEmpty()) continue;
                    out.add(row(tab, cell(r, 9), cell(r, 7), cell(r, 12), cell(r, 11), cell(r, 2),
                            cell(r, 1) + "|" + cell(r, 6)));
                }
                case "연구소" -> {
                    // [번호, 주문일자, 거래처, 휴대전화, 우편번호, 주소, 메세지, 품명, 주문량, 금액]
                    if (!DATE8.matcher(cell(r, 1)).matches() || cell(r, 7).isEmpty() || cell(r, 2).isEmpty()) continue;
                    out.add(row(tab, cell(r, 1), cell(r, 7), cell(r, 9), cell(r, 8), cell(r, 2), null));
                }
                case "초이스" -> {
                    // [주문자명, 폰, 수령자명, 폰, 우편, 주소, 메세지, 상품, 발주수량, 발주유형, box, 정산금액]
                    // 주문일자 열이 없어 자동 수집 불가 — 날짜 열이 생기면 여기서 잡는다.
                    if (cell(r, 7).isEmpty() || cell(r, 8).isEmpty() || cell(r, 0).isEmpty()) continue;
                    if (!cell(r, 8).matches("[\\d,]+")) continue;
                    String date = firstDate8(r);
                    if (date == null) { undated++; continue; }
                    out.add(row(tab, date, cell(r, 7), cell(r, 11), cell(r, 8), cell(r, 0), null));
                }
                case "제로데이" -> {
                    // [주문일자, 거래처, 휴대전화, 우편번호, 주소, 메세지, 품명, 주문량, 발주금액]
                    if (!DATE8.matcher(cell(r, 0)).matches() || cell(r, 6).isEmpty()) continue;
                    out.add(row(tab, cell(r, 0), cell(r, 6), cell(r, 8), cell(r, 7), cell(r, 1), null));
                }
                case "냉장고" -> {
                    // [주문번호, 거래처, 휴대전화, 우편번호, 주소, 품목코드, 품명, 규격, 주문일자, 메세지, 주문량, 금액]
                    if (!DATE8.matcher(cell(r, 8)).matches() || cell(r, 6).isEmpty()) continue;
                    out.add(row(tab, cell(r, 8), cell(r, 6), cell(r, 11), cell(r, 10), cell(r, 1),
                            cell(r, 0).isEmpty() ? null : cell(r, 0) + "|" + cell(r, 5)));
                }
                default -> { }
            }
        }
        return undated;
    }

    /** 행 안 어디든 yyyyMMdd 형태가 있으면 사용 (초이스 탭 대비) */
    private static String firstDate8(List<String> r) {
        for (String c : r) {
            String v = c == null ? "" : c.trim().replaceAll("[.\\-/]", "");
            if (DATE8.matcher(v).matches() && v.startsWith("20")) return v;
        }
        return null;
    }

    private static String cell(List<String> row, int idx) {
        if (idx >= row.size()) return "";
        String v = row.get(idx);
        return v == null ? "" : v.trim();
    }

    private static Map<String, Object> row(String tab, String date, String product,
                                           String amount, String qty, String partner, String key) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tab", tab);
        m.put("date", date);
        m.put("product", product);
        m.put("amount", amount);
        m.put("qty", qty);
        m.put("partner", partner);
        if (key != null) m.put("key", key);
        return m;
    }
}
