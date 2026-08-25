package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.entity.ChannelApiCredential;
import naeil.dashboard.repository.ChannelApiCredentialRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 오프라인 매장 발주 구글시트 연동 (Apps Script push 방식)
 * 시트의 Apps Script가 매일 5개 탭(스토어/연구소/초이스/제로데이/냉장고)을 정규화해
 * POST /api/integrations/offline-sheet/import 로 전송하면
 * orders(판매 분석) + field_sales_entry(일별) + 채널 실적(월별)에 탭별 거래처로 적재한다.
 * 인증: channel_api_credential(channelType=OFFLINE_SHEET)의 credentialKey1 시크릿 대조.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OfflineSheetService {

    private static final Long DEFAULT_COMPANY_ID = 1L;
    private static final String CREATED_BY = "SHEET_SYNC";
    private static final String CREDENTIAL_TYPE = "OFFLINE_SHEET";
    private static final DateTimeFormatter COMPACT = DateTimeFormatter.ofPattern("yyyyMMdd");

    /** 탭 → (채널 표시명, 상점코드) */
    private static final Map<String, String[]> TAB_CHANNELS = Map.of(
            "스토어", new String[]{"제로스토어", "OFF-STORE"},
            "연구소", new String[]{"제로연구소", "OFF-LAB"},
            "초이스", new String[]{"제로초이스", "OFF-CHOICE"},
            "제로데이", new String[]{"제로데이", "OFF-ZERODAY"},
            "냉장고", new String[]{"오프라인(냉장)", "OFF-FRIDGE"}
    );

    private final JdbcTemplate jdbcTemplate;
    private final PlayAutoSyncService playAutoSyncService;
    private final ChannelSyncService channelSyncService;
    private final ChannelApiCredentialRepository credentialRepo;

    public boolean isValidSecret(String secret) {
        if (secret == null || secret.isBlank()) return false;
        return credentialRepo.findByChannelType(CREDENTIAL_TYPE)
                .filter(c -> !Boolean.FALSE.equals(c.getIsActive()))
                .map(ChannelApiCredential::getCredentialKey1)
                .map(stored -> constantTimeEquals(stored.trim(), secret.trim()))
                .orElse(false);
    }

    @Transactional
    public Map<String, Object> importRows(List<Map<String, Object>> rows) {
        int ingested = 0;
        int skipped = 0;
        Map<String, Integer> perTab = new LinkedHashMap<>();
        // channelName -> date -> [amount, count]
        Map<String, TreeMap<LocalDate, long[]>> daily = new HashMap<>();

        for (Map<String, Object> row : rows) {
            String tab = normalizeTab(str(row.get("tab")));
            String[] channel = TAB_CHANNELS.get(tab);
            LocalDate date = parseDate(str(row.get("date")));
            String product = str(row.get("product"));
            long amount = num(row.get("amount"));
            int qty = (int) Math.max(1, num(row.get("qty")));
            if (channel == null || date == null || product == null || amount <= 0) {
                skipped++;
                continue;
            }
            String partner = str(row.get("partner"));
            String key = str(row.get("key"));
            if (key == null) {
                key = date.format(COMPACT) + "|" + (partner == null ? "" : partner) + "|" + product;
            }
            String uniq = "OFF-" + channel[1].substring(4) + "-" + sha1(tab + "|" + key).substring(0, 20);
            playAutoSyncService.upsertDirectOrder(
                    DEFAULT_COMPANY_ID, uniq, channel[1], channel[0],
                    (partner == null ? "" : "[" + partner + "] ") + product,
                    null, qty, BigDecimal.valueOf(amount),
                    date.atTime(12, 0), "발주");
            daily.computeIfAbsent(channel[0], k -> new TreeMap<>())
                    .merge(date, new long[]{amount, 1}, (a, b) -> new long[]{a[0] + b[0], a[1] + b[1]});
            perTab.merge(channel[0], 1, Integer::sum);
            ingested++;
        }

        // 일별 field_sales_entry 갱신 (전송분 = 시트 전체 스냅샷이므로 채널×기간 delete 후 재삽입)
        for (Map.Entry<String, TreeMap<LocalDate, long[]>> e : daily.entrySet()) {
            String channelName = e.getKey();
            TreeMap<LocalDate, long[]> byDate = e.getValue();
            jdbcTemplate.update(
                    "DELETE FROM field_sales_entry WHERE company_id = ? AND channel_name = ? AND created_by = ?",
                    DEFAULT_COMPANY_ID, channelName, CREATED_BY);
            for (Map.Entry<LocalDate, long[]> d : byDate.entrySet()) {
                jdbcTemplate.update(
                        "INSERT INTO field_sales_entry (company_id, channel_name, entry_date, quantity, sales_amount, memo, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        DEFAULT_COMPANY_ID, channelName, java.sql.Date.valueOf(d.getKey()),
                        (int) d.getValue()[1], d.getValue()[0],
                        "오프라인 발주시트 자동수집 (" + d.getValue()[1] + "건)", CREATED_BY);
            }
            // 월별 실적 (온라인 성과 + 실시간 매출)
            Map<YearMonth, long[]> monthly = new TreeMap<>();
            for (Map.Entry<LocalDate, long[]> d : byDate.entrySet()) {
                monthly.merge(YearMonth.from(d.getKey()), new long[]{d.getValue()[0], d.getValue()[1]},
                        (a, b) -> new long[]{a[0] + b[0], a[1] + b[1]});
            }
            for (Map.Entry<YearMonth, long[]> m : monthly.entrySet()) {
                channelSyncService.saveOrUpdateChannelPerformance(
                        channelName, m.getKey().toString(), m.getValue()[0], (int) m.getValue()[1], CREDENTIAL_TYPE);
                upsertExecutiveChannelPerformance(channelName, m.getKey(), m.getValue()[0], (int) m.getValue()[1]);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("ingested", ingested);
        result.put("skipped", skipped);
        result.put("channels", perTab);
        result.put("syncedAt", LocalDateTime.now().toString());
        log.info("[OfflineSheet] import complete: ingested={}, skipped={}, channels={}", ingested, skipped, perTab);
        return result;
    }

    private void upsertExecutiveChannelPerformance(String channelName, YearMonth ym, long total, int orders) {
        java.sql.Date reportMonth = java.sql.Date.valueOf(ym.atDay(1));
        long avg = orders > 0 ? total / orders : 0L;
        int updated = jdbcTemplate.update(
                "UPDATE executive_channel_performance SET sales_amount = ?, order_count = ?, average_order_value = ?, source_type = 'DIRECT_API' " +
                        "WHERE company_id = ? AND channel_name = ? AND report_month = ?",
                total, orders, avg, DEFAULT_COMPANY_ID, channelName, reportMonth);
        if (updated == 0) {
            jdbcTemplate.update(
                    "INSERT INTO executive_channel_performance (company_id, channel_name, sales_amount, order_count, average_order_value, report_month, source_type) " +
                            "VALUES (?, ?, ?, ?, ?, ?, 'DIRECT_API')",
                    DEFAULT_COMPANY_ID, channelName, total, orders, avg, reportMonth);
        }
    }

    private static String normalizeTab(String tab) {
        if (tab == null) return null;
        String t = tab.trim();
        if (t.startsWith("제로데이")) return "제로데이";
        for (String known : TAB_CHANNELS.keySet()) {
            if (t.equals(known) || t.startsWith(known)) return known;
        }
        return t;
    }

    private static LocalDate parseDate(String value) {
        if (value == null) return null;
        String v = value.trim().replaceAll("[.\\-/]", "");
        try {
            if (v.length() == 8) return LocalDate.parse(v, COMPACT);
            return LocalDate.parse(value.trim());
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

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        byte[] x = a.getBytes(StandardCharsets.UTF_8);
        byte[] y = b.getBytes(StandardCharsets.UTF_8);
        if (x.length != y.length) return false;
        int diff = 0;
        for (int i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
        return diff == 0;
    }
}
