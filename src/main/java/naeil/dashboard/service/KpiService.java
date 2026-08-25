package naeil.dashboard.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * KPI·성과급 시스템 v2.
 * - 실적: orders(직연동+시트, 취소 제외). 영업이익 추정 = 매출 − 채널 수수료(promo_channel_default 요율).
 * - 평가: 팀 가중치(kpi_team) × 팀 점수(자동 달성률 × auto_ratio + 정성 점수 × 나머지)로 풀 배분.
 *   팀몫(team_ratio%)은 팀원 균등, 개인몫은 개인 점수 비례. 정성 미입력 = 100점(감점제).
 * - 마감·확정: kpi_snapshot(DRAFT→CONFIRMED, payload 보존) + kpi_payout(반기 지급 대장, 조정액·사유).
 *   확정된 기간은 저장된 payload를 그대로 서빙 — 원본 데이터가 바뀌어도 지급 근거 불변.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KpiService {

    private static final Long COMPANY = 1L;
    private static final String CANCELS = "('취소완료', '반품완료', '교환완료', '맞교환완료', '주문취소')";
    private static final ObjectMapper MAPPER = new ObjectMapper();

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

    /* ───────── 팀 (가중치·자동비중) ───────── */

    public List<Map<String, Object>> getTeams() {
        return jdbcTemplate.queryForList(
                "SELECT team_name, weight, auto_ratio, sort_order FROM kpi_team WHERE company_id = ? ORDER BY sort_order, team_name",
                COMPANY);
    }

    @Transactional
    public Map<String, Object> saveTeams(List<Map<String, Object>> rows) {
        int saved = 0;
        for (Map<String, Object> r : rows) {
            String team = str(r.get("teamName"));
            if (team == null) continue;
            jdbcTemplate.update("""
                    INSERT INTO kpi_team (company_id, team_name, weight, auto_ratio, sort_order, updated_at)
                    VALUES (?, ?, ?, ?, ?, NOW())
                    ON CONFLICT (company_id, team_name)
                    DO UPDATE SET weight = EXCLUDED.weight, auto_ratio = EXCLUDED.auto_ratio,
                                  sort_order = EXCLUDED.sort_order, updated_at = NOW()
                    """, COMPANY, team, dec(r.get("weight")), dec(r.get("autoRatio")),
                    (int) num(r.get("sortOrder")));
            saved++;
        }
        return Map.of("success", true, "saved", saved);
    }

    /* ───────── 정성 평가 점수 ───────── */

    public List<Map<String, Object>> getScores(String periodKey) {
        return jdbcTemplate.queryForList("""
                SELECT team_name, assignee_name, score, memo FROM kpi_score
                WHERE company_id = ? AND period_key = ?
                ORDER BY team_name, assignee_name
                """, COMPANY, periodKey);
    }

    @Transactional
    public Map<String, Object> saveScores(String periodKey, List<Map<String, Object>> rows) {
        if (isConfirmed(periodKey)) {
            return Map.of("success", false, "message", "확정된 기간입니다. 재오픈 후 수정하세요.");
        }
        int saved = 0;
        for (Map<String, Object> r : rows) {
            String team = str(r.get("teamName"));
            if (team == null) continue;
            String assignee = str(r.get("assigneeName")) == null ? "" : str(r.get("assigneeName"));
            jdbcTemplate.update("""
                    INSERT INTO kpi_score (company_id, period_key, team_name, assignee_name, score, memo, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                    ON CONFLICT (company_id, period_key, team_name, assignee_name)
                    DO UPDATE SET score = EXCLUDED.score, memo = EXCLUDED.memo, updated_at = NOW()
                    """, COMPANY, periodKey, team, assignee, dec(r.get("score")), str(r.get("memo")));
            saved++;
        }
        return Map.of("success", true, "saved", saved);
    }

    /* ───────── 담당 매핑 ───────── */

    public List<Map<String, Object>> getAssignments() {
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

    /* ───────── 실적 조회 (확정 시 스냅샷 서빙) ───────── */

    public Map<String, Object> getPerformance(String periodType, String anchor) {
        String pk = periodKey(periodType, anchor);
        if (pk != null) {
            Map<String, Object> snap = findSnapshot(periodType, pk);
            if (snap != null && "CONFIRMED".equals(snap.get("status")) && snap.get("payload") != null) {
                Map<String, Object> stored = parseJson(String.valueOf(snap.get("payload")));
                if (stored != null) {
                    stored.put("snapshotStatus", "CONFIRMED");
                    stored.put("confirmedAt", String.valueOf(snap.get("confirmed_at")));
                    stored.put("periodKey", pk);
                    stored.put("payouts", loadPayouts(((Number) snap.get("id")).longValue()));
                    return stored;
                }
            }
        }
        Map<String, Object> live = computeLive(periodType, anchor);
        if (pk != null) {
            Map<String, Object> snap = findSnapshot(periodType, pk);
            live.put("snapshotStatus", snap == null ? null : snap.get("status"));
            live.put("periodKey", pk);
            if (snap != null) {
                live.put("payouts", loadPayouts(((Number) snap.get("id")).longValue()));
            }
        }
        return live;
    }

    /* ───────── 실적 집계 (라이브 계산) ───────── */

    @SuppressWarnings("unchecked")
    private Map<String, Object> computeLive(String periodType, String anchor) {
        LocalDate[] range = resolveRange(periodType, anchor);
        LocalDate start = range[0];
        LocalDate end = range[1];
        LocalDate prevStart = start.minusYears(1);
        LocalDate prevEnd = end.minusYears(1);
        String pk = periodKey(periodType, anchor);

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

        Map<String, String[]> assignment = new HashMap<>();
        for (Map<String, Object> row : jdbcTemplate.queryForList(
                "SELECT channel_name, team_name, assignee_name FROM performance_assignment WHERE company_id = ?", COMPANY)) {
            assignment.put(String.valueOf(row.get("channel_name")),
                    new String[]{String.valueOf(row.get("team_name")), row.get("assignee_name") == null ? null : String.valueOf(row.get("assignee_name"))});
        }

        Map<String, Long> teamTargets = new HashMap<>();
        Map<String, Long> personTargets = new HashMap<>();
        for (Map<String, Object> row : getTargets(YearMonth.from(start).toString(), YearMonth.from(end).toString())) {
            String team = String.valueOf(row.get("team_name"));
            String assignee = String.valueOf(row.get("assignee_name"));
            long target = ((Number) row.get("target_sales")).longValue();
            if (assignee == null || assignee.isBlank()) teamTargets.merge(team, target, Long::sum);
            else personTargets.merge(team + "|" + assignee, target, Long::sum);
        }

        // 팀 설정 (가중치·자동비중)
        Map<String, double[]> teamCfg = new LinkedHashMap<>(); // team -> [weight, autoRatio, sortOrder]
        for (Map<String, Object> row : getTeams()) {
            teamCfg.put(String.valueOf(row.get("team_name")), new double[]{
                    ((Number) row.get("weight")).doubleValue(),
                    ((Number) row.get("auto_ratio")).doubleValue(),
                    ((Number) row.get("sort_order")).doubleValue()});
        }

        // 정성 점수 (해당 기간)
        Map<String, double[]> teamManual = new HashMap<>();    // team -> [score]
        Map<String, Double> personManual = new HashMap<>();    // team|assignee -> score
        Map<String, String> scoreMemos = new HashMap<>();
        if (pk != null) {
            for (Map<String, Object> row : getScores(pk)) {
                String team = String.valueOf(row.get("team_name"));
                String assignee = String.valueOf(row.get("assignee_name"));
                double score = ((Number) row.get("score")).doubleValue();
                String memo = row.get("memo") == null ? null : String.valueOf(row.get("memo"));
                if (assignee == null || assignee.isBlank()) {
                    teamManual.put(team, new double[]{score});
                    if (memo != null) scoreMemos.put(team + "|", memo);
                } else {
                    personManual.put(team + "|" + assignee, score);
                    if (memo != null) scoreMemos.put(team + "|" + assignee, memo);
                }
            }
        }

        // 채널 실적 → 팀/개인 집계
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

            Map<String, Object> team = teams.computeIfAbsent(assign[0], k -> newTeam(k));
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
                ((TreeMap<String, long[]>) team.get("membersRaw"))
                        .merge(assign[1], new long[]{sales, profit, orders},
                                (a, b) -> new long[]{a[0] + b[0], a[1] + b[1], a[2] + b[2]});
            }
            totalSales += sales;
            totalProfit += profit;
            totalPrevSales += prev[0];
        }

        // 설정된 팀은 실적 없어도 노출 (운영/물류·마케팅)
        for (String cfgTeam : teamCfg.keySet()) {
            teams.computeIfAbsent(cfgTeam, k -> newTeam(k));
        }
        // 정성 점수에 등장한 개인은 팀원으로 편입 (비매출 팀 인원 등록 경로)
        for (String key : personManual.keySet()) {
            int idx = key.indexOf('|');
            String team = key.substring(0, idx);
            String assignee = key.substring(idx + 1);
            Map<String, Object> t = teams.computeIfAbsent(team, k -> newTeam(k));
            ((TreeMap<String, long[]>) t.get("membersRaw")).putIfAbsent(assignee, new long[]{0, 0, 0});
        }

        // 팀 목록 정리 + 달성률 + 점수
        List<Map<String, Object>> teamList = new ArrayList<>();
        for (Map<String, Object> team : teams.values()) {
            String name = String.valueOf(team.get("teamName"));
            long sales = (Long) team.get("sales");
            Long target = teamTargets.get(name);
            team.put("targetSales", target);
            Double achievement = target != null && target > 0 ? Math.round(sales * 1000.0 / target) / 10.0 : null;
            team.put("achievement", achievement);
            long prevSales = (Long) team.get("prevSales");
            team.put("yoy", prevSales > 0 ? Math.round((sales - prevSales) * 1000.0 / prevSales) / 10.0 : null);

            double[] cfg = teamCfg.getOrDefault(name, new double[]{0, 70, 99});
            double autoRatio = cfg[1] / 100.0;
            double autoScore = achievement != null ? Math.min(achievement, 120) : 100;
            double manualScore = teamManual.containsKey(name) ? teamManual.get(name)[0] : 100;
            double teamScore = Math.round((autoScore * autoRatio + manualScore * (1 - autoRatio)) * 10) / 10.0;
            team.put("weight", cfg[0]);
            team.put("autoRatio", cfg[1]);
            team.put("autoScore", Math.round(autoScore * 10) / 10.0);
            team.put("manualScore", manualScore);
            team.put("score", teamScore);
            team.put("scoreMemo", scoreMemos.get(name + "|"));

            List<Map<String, Object>> members = new ArrayList<>();
            for (Map.Entry<String, long[]> m : ((TreeMap<String, long[]>) team.get("membersRaw")).entrySet()) {
                Map<String, Object> mem = new LinkedHashMap<>();
                mem.put("assigneeName", m.getKey());
                mem.put("sales", m.getValue()[0]);
                mem.put("profit", m.getValue()[1]);
                mem.put("orders", (int) m.getValue()[2]);
                Long pt = personTargets.get(name + "|" + m.getKey());
                mem.put("targetSales", pt);
                Double pAch = pt != null && pt > 0 ? Math.round(m.getValue()[0] * 1000.0 / pt) / 10.0 : null;
                mem.put("achievement", pAch);
                double pAuto = pAch != null ? Math.min(pAch, 120) : 100;
                double pManual = personManual.getOrDefault(name + "|" + m.getKey(), 100.0);
                mem.put("autoScore", Math.round(pAuto * 10) / 10.0);
                mem.put("manualScore", pManual);
                mem.put("score", Math.round((pAuto * autoRatio + pManual * (1 - autoRatio)) * 10) / 10.0);
                mem.put("scoreMemo", scoreMemos.get(name + "|" + m.getKey()));
                members.add(mem);
            }
            team.put("members", members);
            team.remove("membersRaw");
            attachMetrics(team, name, start, end, prevStart, prevEnd);
            teamList.add(team);
        }
        teamList.sort((a, b) -> {
            double sa = teamCfg.getOrDefault(String.valueOf(a.get("teamName")), new double[]{0, 0, 99})[2];
            double sb = teamCfg.getOrDefault(String.valueOf(b.get("teamName")), new double[]{0, 0, 99})[2];
            return Double.compare(sa, sb);
        });

        // 성과급 풀 + 배분 v2 (팀 가중치 × 팀 점수 → 팀 풀 → 팀몫 균등 + 개인몫 점수 비례)
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

        List<Map<String, Object>> teamPools = new ArrayList<>();
        List<Map<String, Object>> payout = new ArrayList<>();
        if (pool > 0) {
            double denom = 0;
            for (Map<String, Object> t : teamList) {
                double w = ((Number) t.get("weight")).doubleValue();
                double s = ((Number) t.get("score")).doubleValue();
                if (w > 0) denom += w * s;
            }
            for (Map<String, Object> t : teamList) {
                double w = ((Number) t.get("weight")).doubleValue();
                if (w <= 0) continue;
                double s = ((Number) t.get("score")).doubleValue();
                long teamPool = denom > 0 ? Math.round(pool * (w * s) / denom) : 0;
                List<Map<String, Object>> members = (List<Map<String, Object>>) t.get("members");
                Map<String, Object> tp = new LinkedHashMap<>();
                tp.put("teamName", t.get("teamName"));
                tp.put("weight", w);
                tp.put("score", s);
                tp.put("teamPool", teamPool);
                tp.put("memberCount", members.size());
                tp.put("allocated", !members.isEmpty());
                teamPools.add(tp);
                if (members.isEmpty()) continue;

                double scoreSum = 0;
                for (Map<String, Object> m : members) scoreSum += ((Number) m.get("score")).doubleValue();
                for (Map<String, Object> m : members) {
                    double ps = ((Number) m.get("score")).doubleValue();
                    double share = teamRatio / members.size()
                            + (1 - teamRatio) * (scoreSum > 0 ? ps / scoreSum : 0);
                    long amount = Math.round(teamPool * share);
                    Map<String, Object> p = new LinkedHashMap<>();
                    p.put("teamName", t.get("teamName"));
                    p.put("assigneeName", m.get("assigneeName"));
                    p.put("score", ps);
                    p.put("profit", m.get("profit"));
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
        Map<String, Object> incentive = new LinkedHashMap<>();
        incentive.put("scaledThreshold", scaledThreshold);
        incentive.put("poolRate", poolRate);
        incentive.put("teamRatio", teamRatio * 100);
        incentive.put("pool", pool);
        incentive.put("teamPools", teamPools);
        incentive.put("payout", payout);
        result.put("incentive", incentive);
        return result;
    }

    private static Map<String, Object> newTeam(String name) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("teamName", name);
        t.put("sales", 0L); t.put("profit", 0L); t.put("orders", 0);
        t.put("prevSales", 0L);
        t.put("channels", new ArrayList<Map<String, Object>>());
        t.put("membersRaw", new TreeMap<String, long[]>());
        return t;
    }

    /** 비매출 팀 자동 지표 (참고용): 운영/물류 = 출고, 마케팅 = 출고 SKU·YoY 등 */
    private void attachMetrics(Map<String, Object> team, String name, LocalDate start, LocalDate end,
                               LocalDate prevStart, LocalDate prevEnd) {
        try {
            if (name.contains("운영") || name.contains("물류")) {
                Map<String, Object> cur = jdbcTemplate.queryForMap("""
                        SELECT COALESCE(SUM(outbound_count), 0)::bigint AS qty, COUNT(*)::int AS cnt
                        FROM product_outbound WHERE company_id = ? AND outbound_date BETWEEN ? AND ?
                        """, COMPANY, java.sql.Date.valueOf(start), java.sql.Date.valueOf(end));
                Map<String, Object> prev = jdbcTemplate.queryForMap("""
                        SELECT COALESCE(SUM(outbound_count), 0)::bigint AS qty
                        FROM product_outbound WHERE company_id = ? AND outbound_date BETWEEN ? AND ?
                        """, COMPANY, java.sql.Date.valueOf(prevStart), java.sql.Date.valueOf(prevEnd));
                List<Map<String, Object>> metrics = new ArrayList<>();
                metrics.add(metric("출고 수량", cur.get("qty"), prev.get("qty"), "개"));
                metrics.add(metric("출고 건수", cur.get("cnt"), null, "건"));
                team.put("metrics", metrics);
            } else if (name.contains("마케팅")) {
                Map<String, Object> cur = jdbcTemplate.queryForMap("""
                        SELECT ROUND(COALESCE(SUM(o.pay_amt), 0), 0) AS sales, COUNT(*)::int AS cnt
                        FROM orders o JOIN shop s ON s.id = o.shop_id
                        WHERE o.company_id = ? AND s.shop_code <> 'A000'
                          AND o.ord_time::date BETWEEN ? AND ? AND o.ord_status NOT IN %s
                        """.formatted(CANCELS), COMPANY, java.sql.Date.valueOf(start), java.sql.Date.valueOf(end));
                Map<String, Object> prev = jdbcTemplate.queryForMap("""
                        SELECT ROUND(COALESCE(SUM(o.pay_amt), 0), 0) AS sales
                        FROM orders o JOIN shop s ON s.id = o.shop_id
                        WHERE o.company_id = ? AND s.shop_code <> 'A000'
                          AND o.ord_time::date BETWEEN ? AND ? AND o.ord_status NOT IN %s
                        """.formatted(CANCELS), COMPANY, java.sql.Date.valueOf(prevStart), java.sql.Date.valueOf(prevEnd));
                List<Map<String, Object>> metrics = new ArrayList<>();
                metrics.add(metric("전사 매출", cur.get("sales"), prev.get("sales"), "원"));
                metrics.add(metric("전사 주문", cur.get("cnt"), null, "건"));
                team.put("metrics", metrics);
            }
        } catch (Exception e) {
            log.warn("KPI 자동 지표 산출 실패({}): {}", name, e.getMessage());
        }
    }

    private static Map<String, Object> metric(String name, Object value, Object prev, String unit) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("value", value == null ? 0 : ((Number) value).longValue());
        m.put("unit", unit);
        if (prev != null) {
            long p = ((Number) prev).longValue();
            long v = value == null ? 0 : ((Number) value).longValue();
            m.put("prev", p);
            m.put("yoy", p > 0 ? Math.round((v - p) * 1000.0 / p) / 10.0 : null);
        }
        return m;
    }

    /* ───────── 마감·확정 워크플로우 ───────── */

    /** 마감안 생성: 현재 계산을 스냅샷(DRAFT)으로 저장, 반기는 개인별 지급안(kpi_payout) 생성. 기존 조정액은 보존. */
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> close(String periodType, String anchor) {
        String pk = periodKey(periodType, anchor);
        if (pk == null) return Map.of("success", false, "message", "월간/반기만 마감할 수 있습니다.");
        Map<String, Object> existing = findSnapshot(periodType, pk);
        if (existing != null && "CONFIRMED".equals(existing.get("status"))) {
            return Map.of("success", false, "message", "이미 확정된 기간입니다. 재오픈 후 다시 마감하세요.");
        }
        Map<String, Object> perf = computeLive(periodType, anchor);
        long totalSales = ((Number) perf.get("totalSales")).longValue();
        long totalProfit = ((Number) perf.get("totalProfit")).longValue();
        long pool = ((Number) ((Map<String, Object>) perf.get("incentive")).get("pool")).longValue();
        String payload = toJson(perf);

        jdbcTemplate.update("""
                INSERT INTO kpi_snapshot (company_id, period_type, period_key, status, payload, total_sales, total_profit, pool, created_at)
                VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, NOW())
                ON CONFLICT (company_id, period_type, period_key)
                DO UPDATE SET status = 'DRAFT', payload = EXCLUDED.payload, total_sales = EXCLUDED.total_sales,
                              total_profit = EXCLUDED.total_profit, pool = EXCLUDED.pool, created_at = NOW(), confirmed_at = NULL
                """, COMPANY, periodType, pk, payload, totalSales, totalProfit, pool);
        Map<String, Object> snap = findSnapshot(periodType, pk);
        long snapId = ((Number) snap.get("id")).longValue();

        if ("half".equals(periodType)) {
            // 기존 조정액 보존
            Map<String, long[]> oldAdjust = new HashMap<>();
            Map<String, String> oldReason = new HashMap<>();
            for (Map<String, Object> p : loadPayouts(snapId)) {
                oldAdjust.put(p.get("team_name") + "|" + p.get("assignee_name"),
                        new long[]{((Number) p.get("adjust_amount")).longValue()});
                if (p.get("reason") != null) oldReason.put(p.get("team_name") + "|" + p.get("assignee_name"), String.valueOf(p.get("reason")));
            }
            jdbcTemplate.update("DELETE FROM kpi_payout WHERE snapshot_id = ?", snapId);
            List<Map<String, Object>> payoutList =
                    (List<Map<String, Object>>) ((Map<String, Object>) perf.get("incentive")).get("payout");
            for (Map<String, Object> p : payoutList) {
                String key = p.get("teamName") + "|" + p.get("assigneeName");
                long base = ((Number) p.get("incentive")).longValue();
                long adjust = oldAdjust.containsKey(key) ? oldAdjust.get(key)[0] : 0;
                jdbcTemplate.update("""
                        INSERT INTO kpi_payout (snapshot_id, company_id, period_key, team_name, assignee_name,
                                                base_amount, adjust_amount, final_amount, reason, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                        """, snapId, COMPANY, pk, p.get("teamName"), p.get("assigneeName"),
                        base, adjust, base + adjust, oldReason.get(key));
            }
        }
        return Map.of("success", true, "status", "DRAFT", "periodKey", pk, "payouts", loadPayouts(snapId));
    }

    /** 최종 확정: DRAFT 스냅샷을 잠그고 지급액(final)을 못박는다. 스냅샷이 없으면 즉시 마감 후 확정. */
    @Transactional
    public Map<String, Object> confirm(String periodType, String anchor, String memo) {
        String pk = periodKey(periodType, anchor);
        if (pk == null) return Map.of("success", false, "message", "월간/반기만 확정할 수 있습니다.");
        Map<String, Object> snap = findSnapshot(periodType, pk);
        if (snap == null) {
            Map<String, Object> closed = close(periodType, anchor);
            if (Boolean.FALSE.equals(closed.get("success"))) return closed;
            snap = findSnapshot(periodType, pk);
        }
        if ("CONFIRMED".equals(snap.get("status"))) {
            return Map.of("success", false, "message", "이미 확정된 기간입니다.");
        }
        long snapId = ((Number) snap.get("id")).longValue();
        jdbcTemplate.update("UPDATE kpi_payout SET final_amount = base_amount + adjust_amount, updated_at = NOW() WHERE snapshot_id = ?", snapId);
        jdbcTemplate.update("UPDATE kpi_snapshot SET status = 'CONFIRMED', confirmed_at = NOW(), memo = ? WHERE id = ?",
                memo, snapId);
        return Map.of("success", true, "status", "CONFIRMED", "periodKey", pk, "payouts", loadPayouts(snapId));
    }

    /** 재오픈: 확정 해제 (대표 전용 — 화면 권한으로 제어) */
    @Transactional
    public Map<String, Object> reopen(String periodType, String anchor) {
        String pk = periodKey(periodType, anchor);
        if (pk == null) return Map.of("success", false, "message", "잘못된 기간입니다.");
        int n = jdbcTemplate.update(
                "UPDATE kpi_snapshot SET status = 'DRAFT', confirmed_at = NULL WHERE company_id = ? AND period_type = ? AND period_key = ? AND status = 'CONFIRMED'",
                COMPANY, periodType, pk);
        return n > 0 ? Map.of("success", true, "status", "DRAFT", "periodKey", pk)
                : Map.of("success", false, "message", "확정된 스냅샷이 없습니다.");
    }

    /** 지급안 조정 (DRAFT 상태에서만) */
    @Transactional
    public Map<String, Object> adjustPayout(long payoutId, long adjustAmount, String reason) {
        Map<String, Object> st;
        try {
            st = jdbcTemplate.queryForMap(
                    "SELECT s.status FROM kpi_payout p JOIN kpi_snapshot s ON s.id = p.snapshot_id WHERE p.id = ?", payoutId);
        } catch (Exception e) {
            return Map.of("success", false, "message", "지급안 항목이 없습니다.");
        }
        if (!"DRAFT".equals(st.get("status"))) {
            return Map.of("success", false, "message", "확정된 지급안은 수정할 수 없습니다. 재오픈하세요.");
        }
        jdbcTemplate.update(
                "UPDATE kpi_payout SET adjust_amount = ?, final_amount = base_amount + ?, reason = ?, updated_at = NOW() WHERE id = ?",
                adjustAmount, adjustAmount, reason, payoutId);
        return Map.of("success", true);
    }

    /** 확정 이력 (지급 대장): 확정 스냅샷 + 반기 개인별 지급액 */
    public Map<String, Object> history() {
        List<Map<String, Object>> snapshots = jdbcTemplate.queryForList("""
                SELECT id, period_type, period_key, status, total_sales, total_profit, pool, memo,
                       created_at::date AS closed_date, confirmed_at::date AS confirmed_date
                FROM kpi_snapshot WHERE company_id = ?
                ORDER BY period_key DESC, period_type
                """, COMPANY);
        List<Map<String, Object>> payouts = jdbcTemplate.queryForList("""
                SELECT p.id, p.snapshot_id, p.period_key, p.team_name, p.assignee_name,
                       p.base_amount, p.adjust_amount, p.final_amount, p.reason, s.status
                FROM kpi_payout p JOIN kpi_snapshot s ON s.id = p.snapshot_id
                WHERE p.company_id = ?
                ORDER BY p.period_key DESC, p.team_name, p.assignee_name
                """, COMPANY);
        return Map.of("snapshots", snapshots, "payouts", payouts);
    }

    /* ───────── 내부 유틸 ───────── */

    private Map<String, Object> findSnapshot(String periodType, String periodKey) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, status, payload, confirmed_at FROM kpi_snapshot WHERE company_id = ? AND period_type = ? AND period_key = ?",
                COMPANY, periodType, periodKey);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<Map<String, Object>> loadPayouts(long snapshotId) {
        return jdbcTemplate.queryForList("""
                SELECT id, team_name, assignee_name, base_amount, adjust_amount, final_amount, reason
                FROM kpi_payout WHERE snapshot_id = ? ORDER BY team_name, assignee_name
                """, snapshotId);
    }

    private boolean isConfirmed(String periodKey) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*)::int FROM kpi_snapshot WHERE company_id = ? AND period_key = ? AND status = 'CONFIRMED'",
                Integer.class, COMPANY, periodKey);
        return n != null && n > 0;
    }

    /** month → 2026-08, half → 2026-H2. 그 외(분기/연간)는 마감 대상 아님 → null */
    private static String periodKey(String periodType, String anchor) {
        YearMonth ym;
        try {
            ym = YearMonth.parse(anchor.substring(0, 7));
        } catch (Exception e) {
            ym = YearMonth.now();
        }
        if ("month".equals(periodType)) return ym.toString();
        if ("half".equals(periodType)) return ym.getYear() + (ym.getMonthValue() <= 6 ? "-H1" : "-H2");
        return null;
    }

    private static String toJson(Object o) {
        try { return MAPPER.writeValueAsString(o); }
        catch (Exception e) { return null; }
    }

    private static Map<String, Object> parseJson(String json) {
        try { return MAPPER.readValue(json, new TypeReference<LinkedHashMap<String, Object>>() {}); }
        catch (Exception e) { return null; }
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
