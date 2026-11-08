package naeil.dashboard.service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 현금흐름 예측 엔진.
 * 수동 입력(executive_cash_flow)에만 의존하지 않고, 이미 다른 메뉴에 등록된 데이터를
 * 규칙으로 펼쳐 향후 입출금 예정을 자동 생성한다.
 *  - 운영 비용(매월 반복) / 부채 상환(월 납입) / 채권(미수금 만기) / 컨설팅 잔금
 *  - 온라인 주문(PlayAuto) 기반 채널 정산 예정 (채널별 정산주기·수수료 추정)
 *  - 수동 입출금 예정 + 반복 규칙(MONTHLY/WEEKLY) 전개
 */
@Component
@RequiredArgsConstructor
public class CashFlowForecastBuilder {

    public static final int CHART_DAYS = 30;
    public static final int HORIZON_DAYS = 90;
    public static final int STALE_BALANCE_DAYS = 7;
    public static final long RISK_BALANCE = 30_000_000L;

    private final JdbcTemplate jdbcTemplate;

    public Map<String, Object> build(
            Long companyId,
            List<Map<String, Object>> accounts,
            List<Map<String, Object>> operatingExpenses,
            List<Map<String, Object>> receivables
    ) {
        LocalDate today = LocalDate.now();
        LocalDate horizon = today.plusDays(HORIZON_DAYS);

        List<Map<String, Object>> items = new ArrayList<>();
        List<Map<String, Object>> delayed = new ArrayList<>();
        List<Map<String, Object>> unscheduled = new ArrayList<>();

        Set<String> manualKeys = addManualFlows(companyId, today, horizon, items, delayed);
        addOperatingExpenses(operatingExpenses, today, horizon, items);
        addDebts(companyId, today, horizon, items);
        addReceivables(receivables, today, horizon, items, delayed, unscheduled);
        addConsulting(companyId, today, horizon, items, delayed);
        addOnlineSettlements(companyId, today, horizon, items, manualKeys);

        items.sort(Comparator.comparing((Map<String, Object> row) -> (LocalDate) row.get("flow_date"))
                .thenComparing(row -> -toLong(row.get("amount"))));

        long openingCash = accounts.stream().mapToLong(row -> toLong(row.get("balance"))).sum();

        // 일별 예상 잔액 (90일)
        Map<LocalDate, long[]> daily = new LinkedHashMap<>();
        for (Map<String, Object> item : items) {
            LocalDate date = (LocalDate) item.get("flow_date");
            long[] bucket = daily.computeIfAbsent(date, key -> new long[2]);
            if ("INFLOW".equals(item.get("flow_type"))) bucket[0] += toLong(item.get("amount"));
            else bucket[1] += toLong(item.get("amount"));
        }

        List<Map<String, Object>> projection = new ArrayList<>();
        long running = openingCash;
        LocalDate zeroDate = null;
        LocalDate riskDate = null;
        Map<String, Object> lowest = null;
        for (int i = 0; i <= HORIZON_DAYS; i++) {
            LocalDate date = today.plusDays(i);
            long[] bucket = daily.getOrDefault(date, new long[2]);
            running += bucket[0] - bucket[1];
            if (zeroDate == null && running < 0) zeroDate = date;
            if (riskDate == null && running < RISK_BALANCE) riskDate = date;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("target_date", date);
            row.put("inflow", bucket[0]);
            row.put("outflow", bucket[1]);
            row.put("projected_balance", running);
            if (i <= CHART_DAYS) {
                projection.add(row);
                if (lowest == null || running < toLong(lowest.get("projected_balance"))) lowest = row;
            }
        }

        LocalDate chartEnd = today.plusDays(CHART_DAYS);
        LocalDate weekEnd = today.plusDays(6);
        LocalDate monthEnd = today.withDayOfMonth(today.lengthOfMonth());
        long todayIn = 0, todayOut = 0, weekIn = 0, weekOut = 0, monthIn = 0, monthOut = 0, in30 = 0, out30 = 0;
        Map<String, Map<String, Object>> bySource = new LinkedHashMap<>();
        List<Map<String, Object>> inflows = new ArrayList<>();
        List<Map<String, Object>> outflows = new ArrayList<>();
        for (Map<String, Object> item : items) {
            LocalDate date = (LocalDate) item.get("flow_date");
            long amount = toLong(item.get("amount"));
            boolean in = "INFLOW".equals(item.get("flow_type"));
            if (date.equals(today)) { if (in) todayIn += amount; else todayOut += amount; }
            if (!date.isAfter(weekEnd)) { if (in) weekIn += amount; else weekOut += amount; }
            if (!date.isAfter(monthEnd)) { if (in) monthIn += amount; else monthOut += amount; }
            if (date.isAfter(chartEnd)) continue;
            if (in) { in30 += amount; inflows.add(item); } else { out30 += amount; outflows.add(item); }
            Map<String, Object> summary = bySource.computeIfAbsent((String) item.get("source_type"), key -> {
                Map<String, Object> s = new LinkedHashMap<>();
                s.put("source_type", key);
                s.put("source_label", item.get("source_label"));
                s.put("count", 0L);
                s.put("inflow", 0L);
                s.put("outflow", 0L);
                return s;
            });
            summary.put("count", toLong(summary.get("count")) + 1);
            summary.put(in ? "inflow" : "outflow", toLong(summary.get(in ? "inflow" : "outflow")) + amount);
        }

        List<Map<String, Object>> bigFlows = new ArrayList<>(inflows);
        bigFlows.addAll(outflows);
        bigFlows.sort(Comparator.comparing((Map<String, Object> row) -> -toLong(row.get("amount"))));
        if (bigFlows.size() > 5) bigFlows = new ArrayList<>(bigFlows.subList(0, 5));
        bigFlows.sort(Comparator.comparing(row -> (LocalDate) row.get("flow_date")));

        List<Map<String, Object>> upcomingOutflows = outflows.stream()
                .sorted(Comparator.comparing((Map<String, Object> row) -> (LocalDate) row.get("flow_date")))
                .limit(8)
                .toList();

        // 계좌 잔액 신선도
        LocalDate oldestAsOf = null;
        LocalDate latestAsOf = null;
        for (Map<String, Object> account : accounts) {
            LocalDate asOf = toLocalDate(account.get("as_of_date"));
            if (asOf == null) continue;
            if (oldestAsOf == null || asOf.isBefore(oldestAsOf)) oldestAsOf = asOf;
            if (latestAsOf == null || asOf.isAfter(latestAsOf)) latestAsOf = asOf;
        }
        long staleDays = oldestAsOf == null ? -1 : ChronoUnit.DAYS.between(oldestAsOf, today);
        Map<String, Object> freshness = new LinkedHashMap<>();
        freshness.put("oldest_as_of", oldestAsOf);
        freshness.put("latest_as_of", latestAsOf);
        freshness.put("stale_days", staleDays);
        freshness.put("is_stale", accounts.isEmpty() || staleDays < 0 || staleDays > STALE_BALANCE_DAYS);
        freshness.put("threshold_days", STALE_BALANCE_DAYS);

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("opening_cash", openingCash);
        totals.put("today_inflow", todayIn);
        totals.put("today_outflow", todayOut);
        totals.put("week_inflow", weekIn);
        totals.put("week_outflow", weekOut);
        totals.put("month_inflow", monthIn);
        totals.put("month_outflow", monthOut);
        totals.put("inflow_30d", in30);
        totals.put("outflow_30d", out30);
        totals.put("delayed_inflow_amount", delayed.stream().mapToLong(row -> toLong(row.get("amount"))).sum());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totals", totals);
        result.put("dailyProjection", projection);
        result.put("cashZeroDate", zeroDate);
        result.put("expectedCashShortageDate", zeroDate);
        result.put("riskBalanceDate", riskDate);
        result.put("riskBalanceThreshold", RISK_BALANCE);
        result.put("horizonDays", HORIZON_DAYS);
        result.put("lowestPoint", lowest);
        result.put("inflows", inflows);
        result.put("outflows", outflows);
        result.put("upcomingOutflows", upcomingOutflows);
        result.put("bigFlows", bigFlows);
        result.put("delayedInflows", delayed);
        result.put("unscheduledInflows", unscheduled);
        result.put("sourceSummary", new ArrayList<>(bySource.values()));
        result.put("balanceFreshness", freshness);
        return result;
    }

    // ---------------------------------------------------------------- sources

    private Set<String> addManualFlows(Long companyId, LocalDate today, LocalDate horizon,
                                       List<Map<String, Object>> items, List<Map<String, Object>> delayed) {
        Set<String> sourceKeys = new HashSet<>();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_cash_flow
                WHERE company_id = ?
                  AND COALESCE(status, '') <> 'CANCELLED'
                """, companyId);
        for (Map<String, Object> row : rows) {
            if (row.get("source_key") != null) sourceKeys.add(String.valueOf(row.get("source_key")));
            LocalDate date = toLocalDate(row.get("flow_date"));
            if (date == null) continue;
            String type = String.valueOf(row.get("flow_type"));
            long amount = toLong(row.get("amount"));
            String status = String.valueOf(row.get("status"));
            String rule = String.valueOf(row.getOrDefault("recurring_rule", "NONE"));
            boolean online = "ONLINE_SETTLEMENT".equals(row.get("source_type"));
            String source = online ? "ONLINE_SETTLEMENT" : "MANUAL";
            String label = online ? "온라인 정산" : "직접 입력";
            String confidence = row.get("confidence_level") == null ? "EXPECTED" : String.valueOf(row.get("confidence_level"));

            if ("MONTHLY".equals(rule) || "WEEKLY".equals(rule)) {
                LocalDate occurrence = date;
                int guard = 0;
                while (occurrence.isBefore(today) && guard++ < 1000) {
                    occurrence = "WEEKLY".equals(rule) ? occurrence.plusWeeks(1) : nextMonthly(date, occurrence);
                }
                while (!occurrence.isAfter(horizon) && guard++ < 1000) {
                    boolean doneThisOne = occurrence.equals(date) && "DONE".equals(status);
                    if (!doneThisOne) {
                        items.add(item(occurrence, type, row.get("category"), row.get("counterparty"), amount,
                                source, label + " · 반복", confidence, row.get("memo")));
                    }
                    occurrence = "WEEKLY".equals(rule) ? occurrence.plusWeeks(1) : nextMonthly(date, occurrence);
                }
                continue;
            }

            if ("DONE".equals(status)) continue;
            if (date.isBefore(today)) {
                if ("INFLOW".equals(type)) {
                    delayed.add(item(date, type, row.get("category"), row.get("counterparty"), amount,
                            source, label, confidence, row.get("memo")));
                } else {
                    // 미처리 과거 출금은 보수적으로 오늘 나가는 것으로 본다
                    items.add(item(today, type, row.get("category"), row.get("counterparty"), amount,
                            source, label + " · 미처리", confidence, "원래 예정일 " + date));
                }
                continue;
            }
            if (!date.isAfter(horizon)) {
                items.add(item(date, type, row.get("category"), row.get("counterparty"), amount,
                        source, label, confidence, row.get("memo")));
            }
        }
        return sourceKeys;
    }

    private void addOperatingExpenses(List<Map<String, Object>> expenses, LocalDate today, LocalDate horizon,
                                      List<Map<String, Object>> items) {
        for (Map<String, Object> row : expenses) {
            long amount = toLong(row.get("amount"));
            if (amount <= 0) continue;
            LocalDate base = toLocalDate(row.get("payment_date"));
            if (base == null) base = toLocalDate(row.get("expense_month"));
            if (base == null) continue;
            int day = base.getDayOfMonth();
            LocalDate month = today.withDayOfMonth(1);
            while (!month.isAfter(horizon)) {
                LocalDate date = month.withDayOfMonth(Math.min(day, month.lengthOfMonth()));
                if (!date.isBefore(today) && !date.isAfter(horizon)) {
                    String vendor = row.get("vendor") == null ? "" : String.valueOf(row.get("vendor"));
                    items.add(item(date, "OUTFLOW", row.get("category"), vendor.isBlank() ? row.get("category") : vendor,
                            amount, "OPERATING_EXPENSE", "운영 비용", "FIXED".equals(row.get("expense_type")) ? "CONFIRMED" : "EXPECTED",
                            row.get("memo")));
                }
                month = month.plusMonths(1);
            }
        }
    }

    private void addDebts(Long companyId, LocalDate today, LocalDate horizon, List<Map<String, Object>> items) {
        List<Map<String, Object>> debts = jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_debt
                WHERE company_id = ?
                  AND COALESCE(status, '') NOT IN ('CLOSED', 'DONE', 'PAID')
                """, companyId);
        for (Map<String, Object> row : debts) {
            long payment = toLong(row.get("monthly_payment"));
            LocalDate next = toLocalDate(row.get("next_payment_date"));
            if (payment <= 0 || next == null) continue;
            LocalDate maturity = toLocalDate(row.get("maturity_date"));
            int day = next.getDayOfMonth();
            LocalDate month = (next.isAfter(today) ? next : today).withDayOfMonth(1);
            while (!month.isAfter(horizon)) {
                LocalDate date = month.withDayOfMonth(Math.min(day, month.lengthOfMonth()));
                boolean beforeStart = date.isBefore(next) && next.isAfter(today);
                boolean afterMaturity = maturity != null && date.isAfter(maturity);
                if (!beforeStart && !afterMaturity && !date.isBefore(today) && !date.isAfter(horizon)) {
                    items.add(item(date, "OUTFLOW", "대출 상환", row.get("lender") + " · " + row.get("loan_name"),
                            payment, "DEBT", "부채 상환", "CONFIRMED", null));
                }
                month = month.plusMonths(1);
            }
        }
    }

    private void addReceivables(List<Map<String, Object>> receivables, LocalDate today, LocalDate horizon,
                                List<Map<String, Object>> items, List<Map<String, Object>> delayed,
                                List<Map<String, Object>> unscheduled) {
        for (Map<String, Object> row : receivables) {
            String status = String.valueOf(row.getOrDefault("status", "")).toUpperCase(Locale.ROOT);
            if (Set.of("PAID", "DONE", "CANCELLED", "COMPLETED").contains(status)) continue;
            long open = toLong(row.get("invoice_amount")) - toLong(row.get("paid_amount"));
            if (open <= 0) continue;
            LocalDate due = toLocalDate(row.get("due_date"));
            Map<String, Object> entry = item(due == null ? today : due, "INFLOW", "채권 회수", row.get("partner_name"),
                    open, "RECEIVABLE", "채권(미수금)", "OVERDUE".equals(status) ? "CONSERVATIVE" : "EXPECTED", row.get("memo"));
            if (due == null) unscheduled.add(entry);
            else if (due.isBefore(today)) delayed.add(entry);
            else if (!due.isAfter(horizon)) items.add(entry);
        }
    }

    private void addConsulting(Long companyId, LocalDate today, LocalDate horizon,
                               List<Map<String, Object>> items, List<Map<String, Object>> delayed) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_consulting_revenue
                WHERE company_id = ?
                  AND COALESCE(status, '') NOT IN ('CANCELLED', 'DONE', 'PAID')
                  AND contract_amount > paid_amount
                """, companyId);
        for (Map<String, Object> row : rows) {
            long open = toLong(row.get("contract_amount")) - toLong(row.get("paid_amount"));
            LocalDate date = toLocalDate(row.get("expected_payment_date"));
            if (open <= 0 || date == null) continue;
            Map<String, Object> entry = item(date, "INFLOW", "컨설팅 잔금", row.get("client_name"), open,
                    "CONSULTING", "컨설팅 매출", "EXPECTED", row.get("project_name"));
            if (date.isBefore(today)) delayed.add(entry);
            else if (!date.isAfter(horizon)) items.add(entry);
        }
    }

    /**
     * PlayAuto 주문 → 채널 정산 입금 예정 (추정).
     * 결제일 + 채널별 정산 지연일, 결제금액 - 채널 수수료 추정치.
     * 이미 '온라인 정산 불러오기'로 저장된 건(source_key 동일)은 중복 제외.
     */
    private void addOnlineSettlements(Long companyId, LocalDate today, LocalDate horizon,
                                      List<Map<String, Object>> items, Set<String> manualKeys) {
        List<Map<String, Object>> rows;
        try {
            rows = jdbcTemplate.queryForList("""
                    SELECT
                        COALESCE(o.pay_time, o.ord_time, o.wdate)::date AS pay_date,
                        s.shop_name,
                        s.platform,
                        COALESCE(SUM(COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0)), 0) AS pay_amount,
                        COUNT(*) AS order_count
                    FROM orders o
                    JOIN shop s ON s.id = o.shop_id
                    WHERE o.company_id = ?
                      AND COALESCE(o.pay_time, o.ord_time, o.wdate)::date BETWEEN ? AND ?
                      AND s.shop_code <> 'A000'
                    GROUP BY pay_date, s.shop_name, s.platform
                    HAVING COALESCE(SUM(COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0)), 0) > 0
                    """, companyId, today.minusDays(60), today);
        } catch (RuntimeException e) {
            return; // 주문 테이블이 없거나 연동 전이면 건너뜀
        }
        for (Map<String, Object> row : rows) {
            LocalDate payDate = toLocalDate(row.get("pay_date"));
            if (payDate == null) continue;
            ChannelRule rule = channelRule(row.get("shop_name"), row.get("platform"));
            LocalDate settleDate = payDate.plusDays(rule.delayDays());
            if (settleDate.isBefore(today) || settleDate.isAfter(horizon)) continue;
            String legacyKey = "ONLINE_SETTLEMENT:" + companyId + ":" + payDate.plusDays(2) + ":"
                    + row.get("platform") + ":" + row.get("shop_name");
            if (manualKeys.contains(legacyKey)) continue;
            long gross = toLong(row.get("pay_amount"));
            long net = Math.round(gross * (1 - rule.feeRate()));
            items.add(item(settleDate, "INFLOW", "온라인 채널 정산", row.get("shop_name"), net,
                    "ONLINE_AUTO", "온라인 정산(자동 추정)", "EXPECTED",
                    payDate + " 결제 " + row.get("order_count") + "건 · 정산 D+" + rule.delayDays()
                            + " · 수수료 " + Math.round(rule.feeRate() * 1000) / 10.0 + "% 추정"));
        }
    }

    private record ChannelRule(int delayDays, double feeRate) {}

    /** 채널별 정산 주기·수수료 기본값 (보수적 추정치. 실제 정산서 기준으로 조정 필요) */
    private ChannelRule channelRule(Object shopName, Object platform) {
        String key = (String.valueOf(shopName) + " " + String.valueOf(platform)).toLowerCase(Locale.ROOT);
        if (key.contains("쿠팡") || key.contains("coupang")) return new ChannelRule(30, 0.11);
        if (key.contains("스마트스토어") || key.contains("네이버") || key.contains("naver") || key.contains("smartstore"))
            return new ChannelRule(10, 0.055);
        if (key.contains("테무") || key.contains("temu")) return new ChannelRule(15, 0.075);
        if (key.contains("카카오") || key.contains("kakao")) return new ChannelRule(10, 0.08);
        return new ChannelRule(14, 0.10);
    }

    // ---------------------------------------------------------------- helpers

    private static LocalDate nextMonthly(LocalDate anchor, LocalDate current) {
        LocalDate next = current.withDayOfMonth(1).plusMonths(1);
        return next.withDayOfMonth(Math.min(anchor.getDayOfMonth(), next.lengthOfMonth()));
    }

    private static Map<String, Object> item(LocalDate date, String type, Object category, Object counterparty,
                                            long amount, String source, String sourceLabel, String confidence,
                                            Object memo) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("flow_date", date);
        row.put("flow_type", type);
        row.put("category", category == null ? "" : String.valueOf(category));
        row.put("counterparty", counterparty == null ? "" : String.valueOf(counterparty));
        row.put("amount", amount);
        row.put("source_type", source);
        row.put("source_label", sourceLabel);
        row.put("confidence_level", confidence);
        row.put("status", "EXPECTED");
        row.put("memo", memo == null ? "" : String.valueOf(memo));
        return row;
    }

    static long toLong(Object value) {
        if (value == null) return 0L;
        if (value instanceof BigDecimal decimal) return decimal.longValue();
        if (value instanceof Number number) return number.longValue();
        try {
            return new BigDecimal(String.valueOf(value)).longValue();
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    static LocalDate toLocalDate(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDate date) return date;
        if (value instanceof java.sql.Date date) return date.toLocalDate();
        if (value instanceof Timestamp timestamp) return timestamp.toLocalDateTime().toLocalDate();
        if (value instanceof LocalDateTime dateTime) return dateTime.toLocalDate();
        if (value instanceof OffsetDateTime dateTime) return dateTime.toLocalDate();
        if (value instanceof java.util.Date date) return new java.sql.Date(date.getTime()).toLocalDate();
        String text = String.valueOf(value);
        if (text.length() >= 10) {
            try {
                return LocalDate.parse(text.substring(0, 10));
            } catch (RuntimeException ignored) {
                return null;
            }
        }
        return null;
    }
}
