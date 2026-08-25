package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * KPI·성과급 — 팀/개인 × 월·분기·반기·연 실적 집계와 반기 성과급 풀 배분.
 * 실적: orders(직연동+시트, 취소 제외). 영업이익 추정 = 매출 − 채널 수수료(promo_channel_default 요율).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KpiService {

    private static final Long COMPANY = 1L;
    private static final String CANCELS = "('취소완료', '반품완료', '교환완료', '맞교환완료', '주문취소')";

    private final JdbcTemplate jdbcTemplate;

    /* ───────── 설정 ───────── */

    public Map<String, Object> getConfig() {
        return jdbcTemplate.queryForMap(
                "SELECT half_threshold, pool_rate, team_ratio FROM incentive_config WHERE company_id = ?", COMPANY);
    }

    @Transactional
    public Map<String, Object> saveConfig(Map<String, Object> p) {
        jdbcTemplate.update(
                "UPDATE incentive_config SET half_threshold = ?, pool_rate = ?, team_ratio = ?, updated_at = NOW() WHERE company_id = ?",
                num(p.get("halfThreshold")), dec(p.get("poolRate")), dec(p.get("teamRatio")), COMPANY);
        return getConfig();
    }

    /* ───────── 담당 매핑 ───────── */

    public List<Map<String, Object>> getAssignments() {
        // orders에 존재하는 채널 전부 노출 (매핑 없으면 미배정)
        return jdbcTemplate.queryForList("""
                SELECT ch.channel_name,
                       COALESCE(pa.team_name, '미배정') AS team_name,
                       pa.assignee_name,
                       ch.recent_sales
                FROM (
                    SELECT s.shop_name AS channel_name, ROUND(COALESCE(SUM(o.pay_amt), 0), 0) AS recent_sales
                    FROM orders o JOIN shop s ON s.id = o.shop_id
                    WHERE o.company_id = ? AND s.shop_code <> 'A000'
                      AND o.ord_time >= CURRENT_DATE - INTERVAL '90 day'
                    GROUP BY s.shop_name
                ) ch
                LEFT JOIN performance_assignment pa
                       ON pa.company_id = ? AND pa.channel_name = ch.channel_name
                ORDER BY ch.recent_sales DESC
                """, COMPANY, COMPANY);
    }

    @Transactional
    public Map<String, Object> saveAssignments(List<Map<String, Object>> rows) {
        for (Map<String, Object> r : rows) {
            String channel = str(r.get("channelName"));
            if (channel == null) continue;
            jdbcTemplate.update("""
                    INSERT INTO performance_assignment (company_id, channel_name, team_name, assignee_name, updated_at)
                    VALUES (?, ?, ?, ?, NOW())
                    ON CONFLICT (company_id, channel_name)
                    DO UPDATE SET team_name = EXCLUDED.team_name, assignee_name = EXCLUDED.assignee_name, updated_at = NOW()
                    """, COMPANY, channel,
                    str(r.get("teamName")) == null ? "미배정" : str(r.get("teamName")),
                    str(r.get("assigneeName")));
        }
        return Map.of("success", true, "saved", rows.size());
    }

    /* ───────── 목표 ───────── */

    public List<Map<String, Object>> getTargets(String fromMonth, String toMonth) {
        return jdbcTemplate.queryForList("""
                SELECT period_month, team_name, assignee_name, target_sales, memo
                FROM kpi_target
                WHERE company_id = ? AND period_month BETWEEN ? AND ?
                ORDER BY period_month, team_name, assignee_name
                """, COMPANY, fromMonth, toMonth);
    }

    @Transactional
    public Map<String, Object> saveTargets(List<Map<String, Object>> rows) {
        int saved = 0;
        for (Map<String, Object> r : rows) {
            String month = str(r.get("periodMonth"));
            String team = str(r.get("teamName"));
            if (month == null || team == null) continue;
            String assignee = str(r.get("assigneeName")) == null ? "" : str(r.get("assigneeName"));
            jdbcTemplate.update("""
                    INSERT INTO kpi_target (company_id, period_month, team_name, assignee_name, target_sales, memo, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                    ON CONFLICT (company_id, period_month, team_name, assignee_name)
                    DO UPDATE SET target_sales = EXCLUDED.target_sales, memo = EXCLUDED.memo, updated_at = NOW()
                    """, COMPANY, month, team, assignee, num(r.get("targetSales")), str(r.get("memo")));
            saved++;
        }
        return Map.of("success", true, "saved", saved);
    }

    /* ───────── 실적 집계 ───────── */

    public Map<String, Object> getPerformance(String periodType, String anchor) {
        LocalDate[] range = resolveRange(periodType, anchor);
        LocalDate start = range[0];
        LocalDate end = range[1];
        LocalDate prevStart = start.minusYears(1);
        LocalDate prevEnd = end.minusYears(1);

        Map<String, BigDecimal> feeRates = new HashMap<>();
        for (Map<String, Object> row : jdbcTemplate.queryForList(
                "SELECT channel_name, fee_rate FROM promo_channel_default")) {
            feeRates.put(String.valueOf(row.get("channel_name")), (BigDecimal) row.get("fee_rate"));
        }

        List<Map<String, Object>> current = queryChannelSales(start, end);
        Map<String, long[]> prevByChannel = new HashMap<>();
        for (Map<String, Object> row : queryChannelSales(prevStart, prevEnd)) {
            prevByChannel.put(String.valueOf(row.get("channel_name")),
                    new long[]{((Number) row.get("sales")).longValue(), ((Number) row.get("orders")).intValue()});
        }

        Map<String, String[]> assignment = new HashMap<>(); // channel -> [team, assignee]
        for (Map<String, Object> row : jdbcTemplate.queryForList(
                "SELECT channel_name, team_name, assignee_name FROM performance_assignment WHERE company_id = ?", COMPANY)) {
            assignment.put(String.valueOf(row.get("channel_name")),
                    new String[]{String.valueOf(row.get("team_name")), row.get("assignee_name") == null ? null : String.valueOf(row.get("assignee_name"))});
        }

        // 목표: 기간 내 월 합산 (팀/개인)
        Map<String, Long> teamTargets = new HashMap<>();
        Map<String, Long> personTargets = new HashMap<>();
        for (Map<String, Object> row : getTargets(YearMonth.from(start).toString(), YearMonth.from(end).toString())) {
            String team = String.valueOf(row.get("team_name"));
            String assignee = String.valueOf(row.get("assignee_name"));
            long target = ((Number) row.get("target_sales")).longValue();
            if (assignee == null || assignee.isBlank()) teamTargets.merge(team, target, Long::sum);
            else personTargets.merge(team + "|" + assignee, target, Long::sum);
        }

        // 채널 행 구성 + 팀/개인 집계
        Map<String, Map<String, Object>> teams = new TreeMap<>();
        long totalSales = 0;
        long totalProfit = 0;
        long totalPrevSales = 0;
        for (Map<String, Object> row : current) {
            String channel = String.valueOf(row.get("channel_name"));
            long sales = ((Number) row.get("sales")).longValue();
            int orders = ((Number) row.get("orders")).intValue();
            BigDecimal feeRate = feeRates.getOrDefault(baseChannel(channel), BigDecimal.ZERO);
            long fee = BigDecimal.valueOf(sales).multiply(feeRate).divide(BigDecimal.valueOf(100)).longValue();
            long profit = sales - fee;
            String[] assign = assignment.getOrDefault(channel, new String[]{"미배정", null});
            long[] prev = prevByChannel.getOrDefault(channel, new long[]{0, 0});

            Map<String, Object> team = teams.computeIfAbsent(assign[0], k -> {
                Map<String, Object> t = new LinkedHashMap<>();
                t.put("teamName", k);
                t.put("sales", 0L); t.put("profit", 0L); t.put("orders", 0);
                t.put("prevSales", 0L);
                t.put("channels", new ArrayList<Map<String, Object>>());
                t.put("members", new TreeMap<String, long[]>());
                return t;
            });
            team.put("sales", (Long) team.get("sales") + sales);
            team.put("profit", (Long) team.get("profit") + profit);
            team.put("orders", (Integer) team.get("orders") + orders);
            team.put("prevSales", (Long) team.get("prevSales") + prev[0]);

            Map<String, Object> chRow = new LinkedHashMap<>();
            chRow.put("channelName", channel);
            chRow.put("assigneeName", assign[1]);
            chRow.put("sales", sales);
            chRow.put("orders", orders);
            chRow.put("feeRate", feeRate);
            chRow.put("profit", profit);
            chRow.put("prevSales", prev[0]);
            chRow.put("yoy", prev[0] > 0 ? Math.round((sales - prev[0]) * 1000.0 / prev[0]) / 10.0 : null);
            ((List<Map<String, Object>>) team.get("channels")).add(chRow);

            if (assign[1] != null && !assign[1].isBlank()) {
                ((TreeMap<String, long[]>) team.get("members"))
                        .merge(assign[1], new long[]{sales, profit, orders},
                                (a, b) -> new long[]{a[0] + b[0], a[1] + b[1], a[2] + b[2]});
            }
            totalSales += sales;
            totalProfit += profit;
            totalPrevSales += prev[0];
        }

        // 팀 목록 정리 + 달성률
        List<Map<String, Object>> teamList = new ArrayList<>();
        for (Map<String, Object> team : teams.values()) {
            String name = String.valueOf(team.get("teamName"));
            long sales = (Long) team.get("sales");
            Long target = teamTargets.get(name);
            team.put("targetSales", target);
            team.put("achievement", target != null && target > 0 ? Math.round(sales * 1000.0 / target) / 10.0 : null);
            long prevSales = (Long) team.get("prevSales");
            team.put("yoy", prevSales > 0 ? Math.round((sales - prevSales) * 1000.0 / prevSales) / 10.0 : null);
            List<Map<String, Object>> members = new ArrayList<>();
            for (Map.Entry<String, long[]> m : ((TreeMap<String, long[]>) team.get("members")).entrySet()) {
                Map<String, Object> mem = new LinkedHashMap<>();
                mem.put("assigneeName", m.getKey());
                mem.put("sales", m.getValue()[0]);
                mem.put("profit", m.getValue()[1]);
                mem.put("orders", (int) m.getValue()[2]);
                Long pt = personTargets.get(name + "|" + m.getKey());
                mem.put("targetSales", pt);
                mem.put("achievement", pt != null && pt > 0 ? Math.round(m.getValue()[0] * 1000.0 / pt) / 10.0 : null);
                members.add(mem);
            }
            team.put("members", members);
            teamList.add(team);
        }

        // 성과급 풀 (반기/연간 뷰에서 의미)
        Map<String, Object> cfg = getConfig();
        long threshold = ((Number) cfg.get("half_threshold")).longValue();
        double poolRate = ((Number) cfg.get("pool_rate")).doubleValue();
        double teamRatio = ((Number) cfg.get("team_ratio")).doubleValue() / 100.0;
        double periodFactor = switch (periodType == null ? "half" : periodType) {
            case "month" -> 1.0 / 6.0;
            case "quarter" -> 0.5;
            case "year" -> 2.0;
            default -> 1.0;
        };
        long scaledThreshold = Math.round(threshold * periodFactor);
        long pool = totalProfit > scaledThreshold
                ? Math.round((totalProfit - scaledThreshold) * poolRate / 100.0) : 0L;

        List<Map<String, Object>> payout = new ArrayList<>();
        if (pool > 0 && totalProfit > 0) {
            for (Map<String, Object> team : teamList) {
                long teamProfit = (Long) team.get("profit");
                for (Map<String, Object> mem : (List<Map<String, Object>>) team.get("members")) {
                    long personProfit = ((Number) mem.get("profit")).longValue();
                    double teamShare = teamProfit > 0
                            ? teamRatio * ((double) teamProfit / totalProfit) * ((double) personProfit / teamProfit) : 0;
                    double personShare = (1 - teamRatio) * ((double) personProfit / totalProfit);
                    long amount = Math.round(pool * (teamShare + personShare));
                    Map<String, Object> p = new LinkedHashMap<>();
                    p.put("teamName", team.get("teamName"));
                    p.put("assigneeName", mem.get("assigneeName"));
                    p.put("profit", personProfit);
                    p.put("incentive", amount);
                    payout.add(p);
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("periodType", periodType);
        result.put("startDate", start.toString());
        result.put("endDate", end.toString());
        result.put("totalSales", totalSales);
        result.put("totalProfit", totalProfit);
        result.put("prevYearSales", totalPrevSales);
        result.put("yoy", totalPrevSales > 0 ? Math.round((totalSales - totalPrevSales) * 1000.0 / totalPrevSales) / 10.0 : null);
        result.put("teams", teamList);
        result.put("incentive", Map.of(
                "scaledThreshold", scaledThreshold,
                "poolRate", poolRate,
                "teamRatio", teamRatio * 100,
                "pool", pool,
                "payout", payout));
        return result;
    }

    private List<Map<String, Object>> queryChannelSales(LocalDate start, LocalDate end) {
        return jdbcTemplate.queryForList("""
                SELECT s.shop_name AS channel_name,
                       ROUND(COALESCE(SUM(o.pay_amt), 0), 0) AS sales,
                       COUNT(*)::int AS orders
                FROM orders o JOIN shop s ON s.id = o.shop_id
                WHERE o.company_id = ? AND s.shop_code <> 'A000'
                  AND o.ord_time::date BETWEEN ? AND ?
                  AND o.ord_status NOT IN %s
                GROUP BY s.shop_name
                """.formatted(CANCELS),
                COMPANY, java.sql.Date.valueOf(start), java.sql.Date.valueOf(end));
    }

    private static LocalDate[] resolveRange(String periodType, String anchor) {
        YearMonth ym;
        try {
            ym = YearMonth.parse(anchor.substring(0, 7));
        } catch (Exception e) {
            ym = YearMonth.now();
        }
        return switch (periodType == null ? "month" : periodType) {
            case "quarter" -> {
                int q = (ym.getMonthValue() - 1) / 3;
                YearMonth first = YearMonth.of(ym.getYear(), q * 3 + 1);
                yield new LocalDate[]{first.atDay(1), first.plusMonths(2).atEndOfMonth()};
            }
            case "half" -> {
                YearMonth first = YearMonth.of(ym.getYear(), ym.getMonthValue() <= 6 ? 1 : 7);
                yield new LocalDate[]{first.atDay(1), first.plusMonths(5).atEndOfMonth()};
            }
            case "year" -> new LocalDate[]{LocalDate.of(ym.getYear(), 1, 1), LocalDate.of(ym.getYear(), 12, 31)};
            default -> new LocalDate[]{ym.atDay(1), ym.atEndOfMonth()};
        };
    }

    /** '스마트스토어(하이프리)' → '스마트스토어' 등 수수료율 매칭용 기본 채널명 */
    private static String baseChannel(String channel) {
        if (channel == null) return "";
        String base = channel.replaceAll("\\(.*\\)$", "").trim();
        if (base.startsWith("제로") || base.contains("오프라인") || base.contains("위탁") || base.contains("계좌")) return "오프라인";
        if (base.contains("스마트스토어") || base.contains("스토어팜")) return "스마트스토어";
        if (base.contains("아임웹") || base.contains("자사몰")) return "자사몰";
        return base;
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static long num(Object v) {
        if (v == null) return 0L;
        try { return new BigDecimal(String.valueOf(v).replaceAll("[₩,\\s원]", "")).longValue(); }
        catch (Exception e) { return 0L; }
    }

    private static BigDecimal dec(Object v) {
        if (v == null) return BigDecimal.ZERO;
        try { return new BigDecimal(String.valueOf(v)); } catch (Exception e) { return BigDecimal.ZERO; }
    }
}
