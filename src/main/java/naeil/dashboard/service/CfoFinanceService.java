package naeil.dashboard.service;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.finance.FinanceCalculator;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * CFO 재무관리 페이지 백엔드.
 *
 * 설계 원칙:
 *  - 기존 테이블(orders, daily_sales_stats, executive_*, product_cost_channel, field_* ...)은 읽기만 한다.
 *  - 쓰기는 V118 에서 추가한 cfo_* 테이블에만 한다.
 *  - 모든 계산식은 {@link FinanceCalculator} 를 통해서만 수행한다.
 *  - 데이터가 없으면 0으로 왜곡하지 않고 null + available=false 로 내려보낸다.
 *  - 원가/수수료는 cfo_*_history 테이블에서 "주문 당시" 유효한 구간을 찾아 적용하고,
 *    이력이 없으면 현행 product_cost_channel 값으로 폴백한다.
 */
@Service
@RequiredArgsConstructor
public class CfoFinanceService {

    private final JdbcTemplate jdbcTemplate;

    private static final BigDecimal STAR_SHARE_PCT = BigDecimal.valueOf(10);
    private static final BigDecimal GOOD_MARGIN_PCT = BigDecimal.valueOf(30);
    private static final BigDecimal LOW_MARGIN_PCT = BigDecimal.valueOf(10);

    // ─────────────────────────────────────────────────────────────
    // 공통: 기간 매출/원가/변동비 집계 블록
    // ─────────────────────────────────────────────────────────────

    /** PlayAuto 주문(orders) 기반 매출·원가·수수료 추정 집계. */
    private Map<String, Object> orderBlock(Long companyId, LocalDate from, LocalDate to) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    COUNT(*)                                                        AS order_rows,
                    COALESCE(SUM(COALESCE(o.gross_amt, o.pay_amt, 0)), 0)           AS gross_sales,
                    COALESCE(SUM(COALESCE(o.discount_amt, 0)), 0)                   AS discount,
                    COALESCE(SUM(COALESCE(o.cancel_amt, 0)), 0)                     AS refund,
                    COALESCE(SUM(COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0)), 0) AS net_revenue,
                    COALESCE(SUM(COALESCE(o.order_quantity, 1)), 0)                 AS quantity,
                    COALESCE(SUM(CASE WHEN pcc.product_code IS NOT NULL
                        THEN COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0) END), 0) AS matched_revenue,
                    COALESCE(SUM(CASE WHEN pcc.product_code IS NOT NULL
                        THEN COALESCE(o.order_quantity, 1)
                             * COALESCE(ch.production_cost, pcc.production_cost, 0) END), 0) AS cogs_est,
                    COALESCE(SUM((COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0))
                        * COALESCE(fh.fee_rate_pct, pcc.channel_fee_rate * 100, 0) / 100.0), 0) AS channel_fee_est,
                    COALESCE(SUM((COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0))
                        * COALESCE(fh.payment_fee_pct, 0) / 100.0), 0)              AS payment_fee_est,
                    COALESCE(SUM(COALESCE(o.order_quantity, 1)
                        * (COALESCE(fh.logistics_fee, 0) + COALESCE(fh.storage_fee, pcc.storage_fee_unit, 0))), 0) AS logistics_est
                FROM orders o
                JOIN shop s ON s.id = o.shop_id
                CROSS JOIN LATERAL (SELECT COALESCE(o.pay_time, o.ord_time, o.wdate)::date AS d) od
                LEFT JOIN LATERAL (
                    SELECT c.product_code, c.production_cost, c.channel_fee_rate, c.storage_fee_unit, c.product_name
                    FROM product_cost_channel c
                    WHERE c.company_id = o.company_id AND c.is_active = TRUE
                      AND (c.product_code = o.sku_cd OR c.sku_code = o.sku_cd)
                      AND (c.channel_name = s.shop_name
                           OR (c.channel_name = '스마트스토어팜' AND s.shop_name ILIKE '%스마트스토어%'))
                    ORDER BY (c.product_code = o.sku_cd) DESC
                    LIMIT 1
                ) pcc ON TRUE
                LEFT JOIN LATERAL (
                    SELECT h.fee_rate_pct, h.payment_fee_pct, h.logistics_fee, h.storage_fee
                    FROM cfo_channel_fee_history h
                    WHERE h.company_id = o.company_id AND h.deleted_at IS NULL
                      AND (h.channel_name = s.shop_name
                           OR (h.channel_name = '스마트스토어팜' AND s.shop_name ILIKE '%스마트스토어%'))
                      AND (h.product_code IS NULL OR h.product_code = o.sku_cd)
                      AND h.effective_from <= od.d
                      AND (h.effective_to IS NULL OR h.effective_to >= od.d)
                    ORDER BY (h.product_code IS NOT NULL) DESC, h.effective_from DESC
                    LIMIT 1
                ) fh ON TRUE
                LEFT JOIN LATERAL (
                    SELECT h.production_cost
                    FROM cfo_product_cost_history h
                    WHERE h.company_id = o.company_id AND h.deleted_at IS NULL
                      AND h.product_code = COALESCE(pcc.product_code, o.sku_cd)
                      AND h.effective_from <= od.d
                      AND (h.effective_to IS NULL OR h.effective_to >= od.d)
                    ORDER BY (h.channel_name IS NOT NULL) DESC, h.effective_from DESC
                    LIMIT 1
                ) ch ON TRUE
                WHERE o.company_id = ?
                  AND COALESCE(o.pay_time, o.ord_time, o.wdate)::date BETWEEN ? AND ?
                """, companyId, from, to);
        return rows.isEmpty() ? new HashMap<>() : rows.get(0);
    }

    /** 수기 입력(field_*) 집계. */
    private Map<String, Object> fieldBlock(Long companyId, LocalDate from, LocalDate to) {
        Map<String, Object> result = new HashMap<>();
        Map<String, Object> sales = jdbcTemplate.queryForMap("""
                SELECT COALESCE(SUM(sales_amount), 0) AS sales,
                       COALESCE(SUM(cost_amount), 0)  AS cost,
                       COALESCE(SUM(quantity), 0)     AS quantity,
                       COUNT(*)                        AS row_count
                FROM field_sales_entry
                WHERE company_id = ? AND entry_date BETWEEN ? AND ?
                """, companyId, from, to);
        Map<String, Object> ad = jdbcTemplate.queryForMap("""
                SELECT COALESCE(SUM(ad_cost_amount), 0) AS ad_cost, COUNT(*) AS row_count
                FROM field_ad_cost_entry
                WHERE company_id = ? AND entry_date BETWEEN ? AND ?
                """, companyId, from, to);
        Map<String, Object> other = jdbcTemplate.queryForMap("""
                SELECT COALESCE(SUM(amount), 0) AS other_cost, COUNT(*) AS row_count
                FROM field_other_cost_entry
                WHERE company_id = ? AND entry_date BETWEEN ? AND ?
                """, companyId, from, to);
        result.put("sales", sales);
        result.put("ad", ad);
        result.put("other", other);
        return result;
    }

    /** 고정비: 반복 고정비(활성) + executive_operating_expense(FIXED, 기간 내 월). */
    private Map<String, BigDecimal> fixedCostBlock(Long companyId, LocalDate from, LocalDate to) {
        BigDecimal recurring = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(amount), 0)
                FROM cfo_recurring_expense
                WHERE company_id = ? AND is_active = TRUE AND deleted_at IS NULL
                  AND cycle = 'MONTHLY'
                  AND start_month <= ? AND (end_month IS NULL OR end_month >= ?)
                """, BigDecimal.class, companyId, to, from);
        long months = Math.max(1, ChronoUnit.MONTHS.between(YearMonth.from(from), YearMonth.from(to)) + 1);
        BigDecimal recurringTotal = FinanceCalculator.nvl(recurring).multiply(BigDecimal.valueOf(months));
        BigDecimal opFixed = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(amount), 0)
                FROM executive_operating_expense
                WHERE company_id = ? AND expense_type = 'FIXED'
                  AND expense_month BETWEEN date_trunc('month', ?::date)::date AND ?
                """, BigDecimal.class, companyId, from, to);
        BigDecimal opVariable = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(amount), 0)
                FROM executive_operating_expense
                WHERE company_id = ? AND expense_type = 'VARIABLE'
                  AND expense_month BETWEEN date_trunc('month', ?::date)::date AND ?
                """, BigDecimal.class, companyId, from, to);
        Map<String, BigDecimal> map = new HashMap<>();
        map.put("recurring", recurringTotal);
        map.put("opFixed", FinanceCalculator.nvl(opFixed));
        map.put("opVariable", FinanceCalculator.nvl(opVariable));
        map.put("fixedTotal", recurringTotal.add(FinanceCalculator.nvl(opFixed)));
        return map;
    }

    private BigDecimal dec(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal bd) return bd;
        return new BigDecimal(value.toString());
    }

    // ─────────────────────────────────────────────────────────────
    // 1. CFO 요약
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> getSummary(Long companyId, LocalDate from, LocalDate to) {
        long periodDays = ChronoUnit.DAYS.between(from, to) + 1;
        LocalDate prevTo = from.minusDays(1);
        LocalDate prevFrom = prevTo.minusDays(periodDays - 1);

        Map<String, Object> cur = buildPeriodFinancials(companyId, from, to);
        Map<String, Object> prev = buildPeriodFinancials(companyId, prevFrom, prevTo);

        // 현금 현황
        Map<String, Object> cash = jdbcTemplate.queryForMap("""
                SELECT COALESCE(SUM(balance), 0) AS total_balance,
                       MAX(as_of_date)           AS as_of_date,
                       COUNT(*)                  AS account_count
                FROM executive_cash_account
                WHERE company_id = ?
                """, companyId);
        BigDecimal totalCash = dec(cash.get("total_balance"));

        YearMonth thisMonth = YearMonth.from(to);
        Map<String, Object> monthFlow = jdbcTemplate.queryForMap("""
                SELECT COALESCE(SUM(CASE WHEN flow_type = 'INFLOW'  THEN amount END), 0) AS inflow,
                       COALESCE(SUM(CASE WHEN flow_type = 'OUTFLOW' THEN amount END), 0) AS outflow
                FROM executive_cash_flow
                WHERE company_id = ? AND status NOT IN ('CANCELLED')
                  AND flow_date BETWEEN ? AND ?
                """, companyId, thisMonth.atDay(1), thisMonth.atEndOfMonth());

        // 최근 3개월 월평균 순유출 (런웨이)
        LocalDate burnFrom = thisMonth.minusMonths(3).atDay(1);
        LocalDate burnTo = thisMonth.minusMonths(1).atEndOfMonth();
        BigDecimal netOutflow3m = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(CASE WHEN flow_type = 'OUTFLOW' THEN amount ELSE -amount END), 0)
                FROM executive_cash_flow
                WHERE company_id = ? AND status NOT IN ('CANCELLED')
                  AND flow_date BETWEEN ? AND ?
                """, BigDecimal.class, companyId, burnFrom, burnTo);
        BigDecimal avgMonthlyOutflow = FinanceCalculator.nvl(netOutflow3m)
                .divide(BigDecimal.valueOf(3), 0, java.math.RoundingMode.HALF_UP);
        BigDecimal runway = FinanceCalculator.runwayMonths(totalCash, avgMonthlyOutflow);

        // 미수금 / 미지급금
        BigDecimal receivable = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(invoice_amount - paid_amount), 0)
                FROM executive_receivable WHERE company_id = ? AND (invoice_amount - paid_amount) > 0
                """, BigDecimal.class, companyId);
        BigDecimal payable = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(amount), 0)
                FROM partner_payment_ledger
                WHERE company_id = ? AND direction = 'PAYABLE' AND status = 'PENDING'
                """, BigDecimal.class, companyId);

        // 대출
        Map<String, Object> debt = jdbcTemplate.queryForMap("""
                SELECT COALESCE(SUM(principal_balance), 0) AS total_debt,
                       COALESCE(SUM(monthly_payment), 0)   AS monthly_payment,
                       COALESCE(SUM(principal_balance * interest_rate / 1200), 0) AS monthly_interest
                FROM executive_debt WHERE company_id = ? AND status <> 'CLOSED'
                """, companyId);

        // 이번 달 목표 (예산 REVENUE '전체' → 없으면 ceo_financials 목표 합)
        BigDecimal revenueGoal = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(amount), 0) FROM cfo_budget
                WHERE company_id = ? AND deleted_at IS NULL AND budget_type = 'REVENUE'
                  AND budget_month = date_trunc('month', ?::date)::date
                """, BigDecimal.class, companyId, to);
        if (FinanceCalculator.nvl(revenueGoal).signum() == 0) {
            List<Map<String, Object>> goals = jdbcTemplate.queryForList("""
                    SELECT COALESCE(goal_consulting, 0) + COALESCE(goal_online, 0) + COALESCE(goal_export, 0) AS goal
                    FROM executive_ceo_financials WHERE company_id = ?
                    """, companyId);
            revenueGoal = goals.isEmpty() ? BigDecimal.ZERO : dec(goals.get(0).get("goal"));
        }

        BigDecimal netSales = (BigDecimal) cur.get("netSales");
        BigDecimal contributionPct = (BigDecimal) cur.get("contributionMarginPct");
        BigDecimal monthlyFixed = (BigDecimal) cur.get("monthlyFixedCost");
        BigDecimal breakEven = FinanceCalculator.breakEvenRevenue(monthlyFixed, contributionPct);
        BigDecimal goalAchievementPct = FinanceCalculator.ratioPct(netSales, revenueGoal.signum() == 0 ? null : revenueGoal);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("period", Map.of("from", from.toString(), "to", to.toString(),
                "prevFrom", prevFrom.toString(), "prevTo", prevTo.toString()));
        result.put("current", cur);
        result.put("previous", prev);
        Map<String, Object> cashMap = new LinkedHashMap<>();
        cashMap.put("totalBalance", totalCash);
        cashMap.put("asOfDate", cash.get("as_of_date") == null ? null : cash.get("as_of_date").toString());
        cashMap.put("accountCount", cash.get("account_count"));
        cashMap.put("monthExpectedInflow", dec(monthFlow.get("inflow")));
        cashMap.put("monthExpectedOutflow", dec(monthFlow.get("outflow")));
        cashMap.put("avgMonthlyNetOutflow", avgMonthlyOutflow);
        cashMap.put("runwayMonths", runway == null ? "NO_BURN" : runway);
        result.put("cash", cashMap);
        result.put("receivable", receivable);
        result.put("payable", payable);
        result.put("debt", debt);
        result.put("monthlyFixedCost", monthlyFixed);
        result.put("breakEvenRevenue", breakEven);
        result.put("revenueGoal", revenueGoal);
        result.put("goalAchievementPct", goalAchievementPct);
        result.put("briefing", buildBriefing(cur, prev, totalCash, runway, receivable, breakEven, dec(debt.get("total_debt"))));
        return result;
    }

    /** 한 기간의 손익 핵심 수치 계산 (요약/손익 공용). */
    private Map<String, Object> buildPeriodFinancials(Long companyId, LocalDate from, LocalDate to) {
        Map<String, Object> orders = orderBlock(companyId, from, to);
        Map<String, Object> field = fieldBlock(companyId, from, to);
        Map<String, BigDecimal> fixed = fixedCostBlock(companyId, from, to);

        @SuppressWarnings("unchecked")
        Map<String, Object> fieldSales = (Map<String, Object>) field.get("sales");
        @SuppressWarnings("unchecked")
        Map<String, Object> fieldAd = (Map<String, Object>) field.get("ad");
        @SuppressWarnings("unchecked")
        Map<String, Object> fieldOther = (Map<String, Object>) field.get("other");

        // 컨설팅 매출 (입금 기준)
        BigDecimal consulting = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(paid_amount), 0)
                FROM executive_consulting_revenue
                WHERE company_id = ? AND expected_payment_date BETWEEN ? AND ?
                """, BigDecimal.class, companyId, from, to);

        BigDecimal orderGross = dec(orders.get("gross_sales"));
        BigDecimal orderDiscount = dec(orders.get("discount"));
        BigDecimal orderRefund = dec(orders.get("refund"));
        BigDecimal orderNet = dec(orders.get("net_revenue"));
        BigDecimal fieldNet = dec(fieldSales.get("sales"));
        BigDecimal grossSales = orderGross.add(fieldNet).add(FinanceCalculator.nvl(consulting));
        BigDecimal netSales = orderNet.add(fieldNet).add(FinanceCalculator.nvl(consulting));

        BigDecimal cogs = dec(orders.get("cogs_est")).add(dec(fieldSales.get("cost")));
        BigDecimal channelFee = dec(orders.get("channel_fee_est"));
        BigDecimal paymentFee = dec(orders.get("payment_fee_est"));
        BigDecimal logistics = dec(orders.get("logistics_est"));
        BigDecimal adCost = dec(fieldAd.get("ad_cost"));
        BigDecimal variableSelling = channelFee.add(paymentFee).add(logistics).add(adCost);

        BigDecimal grossProfit = FinanceCalculator.grossProfit(netSales, cogs);
        BigDecimal contribution = FinanceCalculator.contributionProfit(netSales, cogs, variableSelling);
        BigDecimal otherSgna = fixed.get("opVariable").add(dec(fieldOther.get("other_cost")));
        BigDecimal operating = FinanceCalculator.operatingProfit(contribution, fixed.get("fixedTotal"), otherSgna);

        // 기간을 월 환산한 고정비 (BEP 용)
        long months = Math.max(1, ChronoUnit.MONTHS.between(YearMonth.from(from), YearMonth.from(to)) + 1);
        BigDecimal monthlyFixedCost = fixed.get("fixedTotal")
                .divide(BigDecimal.valueOf(months), 0, java.math.RoundingMode.HALF_UP);

        BigDecimal matchedRevenue = dec(orders.get("matched_revenue"));
        BigDecimal coverage = FinanceCalculator.ratioPct(matchedRevenue, orderNet.signum() == 0 ? null : orderNet);

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("grossSales", grossSales);
        map.put("discount", orderDiscount);
        map.put("refund", orderRefund);
        map.put("netSales", netSales);
        map.put("consultingRevenue", FinanceCalculator.nvl(consulting));
        map.put("cogs", cogs);
        map.put("grossProfit", grossProfit);
        map.put("grossMarginPct", FinanceCalculator.ratioPct(grossProfit, netSales.signum() == 0 ? null : netSales));
        map.put("channelFee", channelFee);
        map.put("paymentFee", paymentFee);
        map.put("logisticsCost", logistics);
        map.put("adCost", adCost);
        map.put("variableSellingCost", variableSelling);
        map.put("contributionProfit", contribution);
        map.put("contributionMarginPct", FinanceCalculator.ratioPct(contribution, netSales.signum() == 0 ? null : netSales));
        map.put("fixedCost", fixed.get("fixedTotal"));
        map.put("recurringFixedCost", fixed.get("recurring"));
        map.put("otherSgna", otherSgna);
        map.put("operatingProfit", operating);
        map.put("operatingMarginPct", FinanceCalculator.ratioPct(operating, netSales.signum() == 0 ? null : netSales));
        map.put("monthlyFixedCost", monthlyFixedCost);
        map.put("orderQuantity", orders.get("quantity"));
        map.put("costCoveragePct", coverage);
        map.put("dataAvailable", netSales.signum() != 0 || dec(fieldSales.get("row_count")).signum() != 0);
        map.put("basis", Map.of(
                "netSales", "PlayAuto 주문(pay_amt−cancel_amt) + 수기입력 매출 + 컨설팅 입금액",
                "cogs", "주문 당시 원가 이력(cfo_product_cost_history), 없으면 현행 원가 마스터 × 수량 + 수기입력 원가",
                "channelFee", "주문 당시 수수료 이력(cfo_channel_fee_history), 없으면 현행 채널 수수료율 × 순매출",
                "adCost", "수기입력 광고비(field_ad_cost_entry) 합계",
                "fixedCost", "반복 고정비(cfo_recurring_expense) + 운영비(FIXED) 합계",
                "costCoveragePct", "원가 마스터에 매칭된 주문 매출 비율 — 100% 미만이면 원가 미등록 상품 존재"));
        return map;
    }

    /** 규칙 기반 CFO 자동 브리핑 (AI 미연결 환경에서도 동작). */
    private List<String> buildBriefing(Map<String, Object> cur, Map<String, Object> prev, BigDecimal cash,
                                       BigDecimal runway, BigDecimal receivable, BigDecimal breakEven,
                                       BigDecimal totalDebt) {
        List<String> lines = new ArrayList<>();
        BigDecimal netSales = (BigDecimal) cur.get("netSales");
        BigDecimal prevNet = (BigDecimal) prev.get("netSales");
        BigDecimal change = FinanceCalculator.changePct(netSales, prevNet);
        if (change != null) {
            lines.add(String.format("이번 기간 순매출은 직전 기간 대비 %s%.1f%% %s했습니다.",
                    change.signum() >= 0 ? "+" : "", change.abs(), change.signum() >= 0 ? "증가" : "감소"));
        }
        BigDecimal opPct = (BigDecimal) cur.get("operatingMarginPct");
        BigDecimal prevOpPct = (BigDecimal) prev.get("operatingMarginPct");
        if (opPct != null && prevOpPct != null) {
            BigDecimal diff = opPct.subtract(prevOpPct);
            lines.add(String.format("영업이익률은 %.1f%%로 직전 기간 대비 %s%.1f%%p %s했습니다.",
                    opPct, diff.signum() >= 0 ? "+" : "", diff.abs(), diff.signum() >= 0 ? "개선" : "하락"));
        }
        if (runway != null) {
            lines.add(String.format("현재 현금흐름 기준 약 %.1f개월의 운영자금이 확보되어 있습니다.", runway));
            if (runway.compareTo(BigDecimal.valueOf(3)) < 0) {
                lines.add("⚠ 런웨이가 3개월 미만입니다. 미수금 회수와 비용 집행 시점 조정이 필요합니다.");
            }
        } else if (cash != null && cash.signum() > 0) {
            lines.add("최근 3개월 기준 순현금유출이 없어 현금 소진 없이 운영 중입니다.");
        }
        if (breakEven != null) {
            lines.add(String.format("현재 고정비 기준 월 손익분기점 매출은 약 %,d원입니다.", breakEven.longValue()));
        }
        if (receivable != null && receivable.signum() > 0) {
            lines.add(String.format("회수해야 할 미수금이 %,d원 있습니다. 입금 지연 시 현금 계획에 반영하세요.", receivable.longValue()));
        }
        if (totalDebt != null && totalDebt.signum() > 0) {
            lines.add(String.format("총 대출 잔액은 %,d원입니다.", totalDebt.longValue()));
        }
        BigDecimal coverage = (BigDecimal) cur.get("costCoveragePct");
        if (coverage != null && coverage.compareTo(BigDecimal.valueOf(90)) < 0) {
            lines.add(String.format("주문 매출의 %.0f%%만 원가가 등록되어 있습니다. 원가 미등록 상품을 등록하면 이익 수치가 정확해집니다.", coverage));
        }
        return lines;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. 손익계산서
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> getProfitStatement(Long companyId, YearMonth month) {
        Map<String, Object> cur = buildPeriodFinancials(companyId, month.atDay(1), month.atEndOfMonth());
        YearMonth prevMonth = month.minusMonths(1);
        Map<String, Object> prev = buildPeriodFinancials(companyId, prevMonth.atDay(1), prevMonth.atEndOfMonth());

        BigDecimal budgetRevenue = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(amount), 0) FROM cfo_budget
                WHERE company_id = ? AND deleted_at IS NULL AND budget_type = 'REVENUE' AND budget_month = ?
                """, BigDecimal.class, companyId, month.atDay(1));

        List<Map<String, Object>> lines = new ArrayList<>();
        addLine(lines, "매출", "총매출", cur, prev, "grossSales");
        addLine(lines, "매출 차감", "할인", cur, prev, "discount");
        addLine(lines, "매출 차감", "반품·환불", cur, prev, "refund");
        addLine(lines, "순매출", "순매출", cur, prev, "netSales");
        addLine(lines, "매출원가", "매출원가(제조원가)", cur, prev, "cogs");
        addLine(lines, "매출총이익", "매출총이익", cur, prev, "grossProfit");
        addLine(lines, "판매 변동비", "채널 수수료", cur, prev, "channelFee");
        addLine(lines, "판매 변동비", "결제 수수료", cur, prev, "paymentFee");
        addLine(lines, "판매 변동비", "물류·배송·보관비", cur, prev, "logisticsCost");
        addLine(lines, "판매 변동비", "광고비", cur, prev, "adCost");
        addLine(lines, "공헌이익", "공헌이익", cur, prev, "contributionProfit");
        addLine(lines, "고정비·판관비", "고정비", cur, prev, "fixedCost");
        addLine(lines, "고정비·판관비", "기타 판관비(변동)", cur, prev, "otherSgna");
        addLine(lines, "영업이익", "영업이익", cur, prev, "operatingProfit");

        // 영업외: 이자비용 추정
        BigDecimal interest = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(principal_balance * interest_rate / 1200), 0)
                FROM executive_debt WHERE company_id = ? AND status <> 'CLOSED'
                """, BigDecimal.class, companyId);
        BigDecimal operating = (BigDecimal) cur.get("operatingProfit");
        BigDecimal pretax = operating.subtract(FinanceCalculator.nvl(interest));
        Map<String, Object> interestLine = new LinkedHashMap<>();
        interestLine.put("section", "영업외손익");
        interestLine.put("label", "이자비용(추정)");
        interestLine.put("amount", FinanceCalculator.nvl(interest).negate());
        interestLine.put("prevAmount", null);
        interestLine.put("note", "대출 잔액 × 연이율 ÷ 12 (추정치)");
        lines.add(interestLine);
        Map<String, Object> pretaxLine = new LinkedHashMap<>();
        pretaxLine.put("section", "세전이익");
        pretaxLine.put("label", "세전이익(추정)");
        pretaxLine.put("amount", pretax);
        pretaxLine.put("prevAmount", null);
        pretaxLine.put("note", "법인세는 세무사 확인 전 추정 제외");
        lines.add(pretaxLine);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("month", month.toString());
        result.put("lines", lines);
        result.put("current", cur);
        result.put("previous", prev);
        result.put("budgetRevenue", budgetRevenue);
        result.put("budgetAchievementPct",
                FinanceCalculator.ratioPct((BigDecimal) cur.get("netSales"),
                        FinanceCalculator.nvl(budgetRevenue).signum() == 0 ? null : budgetRevenue));
        return result;
    }

    private void addLine(List<Map<String, Object>> lines, String section, String label,
                         Map<String, Object> cur, Map<String, Object> prev, String key) {
        Map<String, Object> line = new LinkedHashMap<>();
        line.put("section", section);
        line.put("label", label);
        line.put("amount", cur.get(key));
        line.put("prevAmount", prev.get(key));
        line.put("changePct", FinanceCalculator.changePct((BigDecimal) cur.get(key), (BigDecimal) prev.get(key)));
        lines.add(line);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. 상품별 수익성
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> getProductProfitability(Long companyId, LocalDate from, LocalDate to) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    s.shop_name AS channel_name,
                    o.sku_cd    AS product_code,
                    MAX(COALESCE(pcc.product_name, p.product_name, o.sku_cd)) AS product_name,
                    COALESCE(SUM(COALESCE(o.order_quantity, 1)), 0) AS quantity,
                    COALESCE(SUM(COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0)), 0) AS revenue,
                    COALESCE(SUM(COALESCE(o.discount_amt, 0)), 0) AS discount,
                    COALESCE(SUM(CASE WHEN pcc.product_code IS NOT NULL
                        THEN COALESCE(o.order_quantity, 1)
                             * COALESCE(ch.production_cost, pcc.production_cost, 0) END), 0) AS cogs,
                    COALESCE(SUM((COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0))
                        * COALESCE(fh.fee_rate_pct, pcc.channel_fee_rate * 100, 0) / 100.0), 0) AS channel_fee,
                    COALESCE(SUM((COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0))
                        * COALESCE(fh.payment_fee_pct, 0) / 100.0), 0) AS payment_fee,
                    COALESCE(SUM(COALESCE(o.order_quantity, 1)
                        * (COALESCE(fh.logistics_fee, 0) + COALESCE(fh.storage_fee, pcc.storage_fee_unit, 0))), 0) AS logistics,
                    BOOL_OR(pcc.product_code IS NOT NULL) AS cost_matched
                FROM orders o
                JOIN shop s ON s.id = o.shop_id
                LEFT JOIN product p ON p.id = o.product_id
                CROSS JOIN LATERAL (SELECT COALESCE(o.pay_time, o.ord_time, o.wdate)::date AS d) od
                LEFT JOIN LATERAL (
                    SELECT c.product_code, c.production_cost, c.channel_fee_rate, c.storage_fee_unit, c.product_name
                    FROM product_cost_channel c
                    WHERE c.company_id = o.company_id AND c.is_active = TRUE
                      AND (c.product_code = o.sku_cd OR c.sku_code = o.sku_cd)
                      AND (c.channel_name = s.shop_name
                           OR (c.channel_name = '스마트스토어팜' AND s.shop_name ILIKE '%스마트스토어%'))
                    ORDER BY (c.product_code = o.sku_cd) DESC LIMIT 1
                ) pcc ON TRUE
                LEFT JOIN LATERAL (
                    SELECT h.fee_rate_pct, h.payment_fee_pct, h.logistics_fee, h.storage_fee
                    FROM cfo_channel_fee_history h
                    WHERE h.company_id = o.company_id AND h.deleted_at IS NULL
                      AND (h.channel_name = s.shop_name
                           OR (h.channel_name = '스마트스토어팜' AND s.shop_name ILIKE '%스마트스토어%'))
                      AND (h.product_code IS NULL OR h.product_code = o.sku_cd)
                      AND h.effective_from <= od.d AND (h.effective_to IS NULL OR h.effective_to >= od.d)
                    ORDER BY (h.product_code IS NOT NULL) DESC, h.effective_from DESC LIMIT 1
                ) fh ON TRUE
                LEFT JOIN LATERAL (
                    SELECT h.production_cost
                    FROM cfo_product_cost_history h
                    WHERE h.company_id = o.company_id AND h.deleted_at IS NULL
                      AND h.product_code = COALESCE(pcc.product_code, o.sku_cd)
                      AND h.effective_from <= od.d AND (h.effective_to IS NULL OR h.effective_to >= od.d)
                    ORDER BY (h.channel_name IS NOT NULL) DESC, h.effective_from DESC LIMIT 1
                ) ch ON TRUE
                WHERE o.company_id = ?
                  AND COALESCE(o.pay_time, o.ord_time, o.wdate)::date BETWEEN ? AND ?
                GROUP BY s.shop_name, o.sku_cd
                ORDER BY revenue DESC
                """, companyId, from, to);

        // 수기입력 매출도 상품 단위로 포함
        List<Map<String, Object>> fieldRows = jdbcTemplate.queryForList("""
                SELECT COALESCE(f.channel_name, '수기입력') AS channel_name,
                       COALESCE(p.sku_cd, 'FIELD-' || COALESCE(f.product_id::text, '기타')) AS product_code,
                       COALESCE(MAX(p.product_name), '수기입력 상품') AS product_name,
                       COALESCE(SUM(f.quantity), 0)      AS quantity,
                       COALESCE(SUM(f.sales_amount), 0)  AS revenue,
                       0                                  AS discount,
                       COALESCE(SUM(f.cost_amount), 0)   AS cogs,
                       0 AS channel_fee, 0 AS payment_fee, 0 AS logistics,
                       TRUE AS cost_matched
                FROM field_sales_entry f
                LEFT JOIN product p ON p.id = f.product_id
                WHERE f.company_id = ? AND f.entry_date BETWEEN ? AND ?
                GROUP BY f.channel_name, COALESCE(p.sku_cd, 'FIELD-' || COALESCE(f.product_id::text, '기타'))
                """, companyId, from, to);
        rows.addAll(fieldRows);

        // 채널별 광고비를 매출 비중으로 상품에 배부
        List<Map<String, Object>> adByChannel = jdbcTemplate.queryForList("""
                SELECT channel_name, COALESCE(SUM(ad_cost_amount), 0) AS ad_cost
                FROM field_ad_cost_entry
                WHERE company_id = ? AND entry_date BETWEEN ? AND ?
                GROUP BY channel_name
                """, companyId, from, to);
        Map<String, BigDecimal> adMap = new HashMap<>();
        for (Map<String, Object> ad : adByChannel) {
            adMap.put(String.valueOf(ad.get("channel_name")), dec(ad.get("ad_cost")));
        }
        Map<String, BigDecimal> channelRevenue = new HashMap<>();
        BigDecimal totalRevenue = BigDecimal.ZERO;
        for (Map<String, Object> row : rows) {
            String channel = String.valueOf(row.get("channel_name"));
            BigDecimal revenue = dec(row.get("revenue"));
            channelRevenue.merge(channel, revenue, BigDecimal::add);
            totalRevenue = totalRevenue.add(revenue);
        }

        List<Map<String, Object>> enriched = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String channel = String.valueOf(row.get("channel_name"));
            BigDecimal revenue = dec(row.get("revenue"));
            BigDecimal chRev = channelRevenue.getOrDefault(channel, BigDecimal.ZERO);
            BigDecimal chAd = adMap.getOrDefault(channel, BigDecimal.ZERO);
            BigDecimal adAlloc = chRev.signum() == 0 ? BigDecimal.ZERO
                    : chAd.multiply(revenue).divide(chRev, 0, java.math.RoundingMode.HALF_UP);
            BigDecimal cogs = dec(row.get("cogs"));
            BigDecimal variable = dec(row.get("channel_fee")).add(dec(row.get("payment_fee")))
                    .add(dec(row.get("logistics"))).add(adAlloc);
            boolean matched = Boolean.TRUE.equals(row.get("cost_matched"));
            BigDecimal contribution = matched
                    ? FinanceCalculator.contributionProfit(revenue, cogs, variable) : null;
            BigDecimal contributionPct = matched
                    ? FinanceCalculator.ratioPct(contribution, revenue.signum() == 0 ? null : revenue) : null;
            BigDecimal sharePct = FinanceCalculator.ratioPct(revenue, totalRevenue.signum() == 0 ? null : totalRevenue);
            BigDecimal quantity = dec(row.get("quantity"));
            BigDecimal unitContribution = (contribution != null && quantity.signum() > 0)
                    ? contribution.divide(quantity, 0, java.math.RoundingMode.HALF_UP) : null;

            Map<String, Object> out = new LinkedHashMap<>(row);
            out.put("adCostAllocated", adAlloc);
            out.put("contributionProfit", contribution);
            out.put("contributionMarginPct", contributionPct);
            out.put("revenueSharePct", sharePct);
            out.put("unitContribution", unitContribution);
            out.put("classification", matched
                    ? FinanceCalculator.classifyProduct(sharePct, contributionPct, STAR_SHARE_PCT, GOOD_MARGIN_PCT, LOW_MARGIN_PCT)
                    : "원가 미등록");
            enriched.add(out);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("rows", enriched);
        result.put("totalRevenue", totalRevenue);
        result.put("basis", "주문 당시 원가/수수료 이력 적용, 광고비는 채널 매출 비중으로 배부. '원가 미등록' 상품은 공헌이익을 계산하지 않음(숫자를 만들어내지 않음)");
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // 4. 채널별 수익성
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> getChannelProfitability(Long companyId, LocalDate from, LocalDate to) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    s.shop_name AS channel_name,
                    COUNT(*) AS order_count,
                    COALESCE(SUM(COALESCE(o.order_quantity, 1)), 0) AS quantity,
                    COALESCE(SUM(COALESCE(o.gross_amt, o.pay_amt, 0)), 0) AS gross_sales,
                    COALESCE(SUM(COALESCE(o.discount_amt, 0)), 0) AS discount,
                    COALESCE(SUM(COALESCE(o.cancel_amt, 0)), 0) AS refund,
                    COALESCE(SUM(COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0)), 0) AS net_revenue,
                    COALESCE(SUM(CASE WHEN pcc.product_code IS NOT NULL
                        THEN COALESCE(o.order_quantity, 1)
                             * COALESCE(ch.production_cost, pcc.production_cost, 0) END), 0) AS cogs,
                    COALESCE(SUM((COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0))
                        * COALESCE(fh.fee_rate_pct, pcc.channel_fee_rate * 100, 0) / 100.0), 0) AS channel_fee,
                    COALESCE(SUM((COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0))
                        * COALESCE(fh.payment_fee_pct, 0) / 100.0), 0) AS payment_fee,
                    COALESCE(SUM(COALESCE(o.order_quantity, 1)
                        * (COALESCE(fh.logistics_fee, 0) + COALESCE(fh.storage_fee, pcc.storage_fee_unit, 0))), 0) AS logistics,
                    COALESCE(SUM(CASE WHEN pcc.product_code IS NOT NULL
                        THEN COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0) END), 0) AS matched_revenue
                FROM orders o
                JOIN shop s ON s.id = o.shop_id
                CROSS JOIN LATERAL (SELECT COALESCE(o.pay_time, o.ord_time, o.wdate)::date AS d) od
                LEFT JOIN LATERAL (
                    SELECT c.product_code, c.production_cost, c.channel_fee_rate, c.storage_fee_unit
                    FROM product_cost_channel c
                    WHERE c.company_id = o.company_id AND c.is_active = TRUE
                      AND (c.product_code = o.sku_cd OR c.sku_code = o.sku_cd)
                      AND (c.channel_name = s.shop_name
                           OR (c.channel_name = '스마트스토어팜' AND s.shop_name ILIKE '%스마트스토어%'))
                    ORDER BY (c.product_code = o.sku_cd) DESC LIMIT 1
                ) pcc ON TRUE
                LEFT JOIN LATERAL (
                    SELECT h.fee_rate_pct, h.payment_fee_pct, h.logistics_fee, h.storage_fee
                    FROM cfo_channel_fee_history h
                    WHERE h.company_id = o.company_id AND h.deleted_at IS NULL
                      AND (h.channel_name = s.shop_name
                           OR (h.channel_name = '스마트스토어팜' AND s.shop_name ILIKE '%스마트스토어%'))
                      AND (h.product_code IS NULL OR h.product_code = o.sku_cd)
                      AND h.effective_from <= od.d AND (h.effective_to IS NULL OR h.effective_to >= od.d)
                    ORDER BY (h.product_code IS NOT NULL) DESC, h.effective_from DESC LIMIT 1
                ) fh ON TRUE
                LEFT JOIN LATERAL (
                    SELECT h.production_cost
                    FROM cfo_product_cost_history h
                    WHERE h.company_id = o.company_id AND h.deleted_at IS NULL
                      AND h.product_code = COALESCE(pcc.product_code, o.sku_cd)
                      AND h.effective_from <= od.d AND (h.effective_to IS NULL OR h.effective_to >= od.d)
                    ORDER BY (h.channel_name IS NOT NULL) DESC, h.effective_from DESC LIMIT 1
                ) ch ON TRUE
                WHERE o.company_id = ?
                  AND COALESCE(o.pay_time, o.ord_time, o.wdate)::date BETWEEN ? AND ?
                GROUP BY s.shop_name
                ORDER BY net_revenue DESC
                """, companyId, from, to);

        // 수기입력 채널 합산
        List<Map<String, Object>> fieldRows = jdbcTemplate.queryForList("""
                SELECT COALESCE(channel_name, '수기입력') AS channel_name,
                       COUNT(*) AS order_count,
                       COALESCE(SUM(quantity), 0) AS quantity,
                       COALESCE(SUM(sales_amount), 0) AS gross_sales,
                       0 AS discount, 0 AS refund,
                       COALESCE(SUM(sales_amount), 0) AS net_revenue,
                       COALESCE(SUM(cost_amount), 0) AS cogs,
                       0 AS channel_fee, 0 AS payment_fee, 0 AS logistics,
                       COALESCE(SUM(sales_amount), 0) AS matched_revenue
                FROM field_sales_entry
                WHERE company_id = ? AND entry_date BETWEEN ? AND ?
                GROUP BY COALESCE(channel_name, '수기입력')
                """, companyId, from, to);
        rows.addAll(fieldRows);

        List<Map<String, Object>> adByChannel = jdbcTemplate.queryForList("""
                SELECT channel_name, COALESCE(SUM(ad_cost_amount), 0) AS ad_cost
                FROM field_ad_cost_entry WHERE company_id = ? AND entry_date BETWEEN ? AND ?
                GROUP BY channel_name
                """, companyId, from, to);
        Map<String, BigDecimal> adMap = new HashMap<>();
        for (Map<String, Object> ad : adByChannel) {
            adMap.put(String.valueOf(ad.get("channel_name")), dec(ad.get("ad_cost")));
        }

        List<Map<String, Object>> enriched = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String channel = String.valueOf(row.get("channel_name"));
            BigDecimal revenue = dec(row.get("net_revenue"));
            BigDecimal adCost = adMap.getOrDefault(channel, BigDecimal.ZERO);
            BigDecimal cogs = dec(row.get("cogs"));
            BigDecimal variable = dec(row.get("channel_fee")).add(dec(row.get("payment_fee")))
                    .add(dec(row.get("logistics"))).add(adCost);
            BigDecimal contribution = FinanceCalculator.contributionProfit(revenue, cogs, variable);
            BigDecimal orderCount = dec(row.get("order_count"));
            Map<String, Object> out = new LinkedHashMap<>(row);
            out.put("adCost", adCost);
            out.put("roas", FinanceCalculator.safeDivide(revenue, adCost.signum() == 0 ? null : adCost, 2));
            out.put("avgOrderValue", orderCount.signum() == 0 ? null
                    : revenue.divide(orderCount, 0, java.math.RoundingMode.HALF_UP));
            out.put("contributionProfit", contribution);
            out.put("contributionMarginPct",
                    FinanceCalculator.ratioPct(contribution, revenue.signum() == 0 ? null : revenue));
            out.put("costCoveragePct", FinanceCalculator.ratioPct(dec(row.get("matched_revenue")),
                    revenue.signum() == 0 ? null : revenue));
            enriched.add(out);
        }

        List<Map<String, Object>> feeSettings = jdbcTemplate.queryForList("""
                SELECT id, channel_name, product_code, fee_rate_pct, payment_fee_pct,
                       logistics_fee, storage_fee, vat_included, settlement_days,
                       effective_from, effective_to, memo
                FROM cfo_channel_fee_history
                WHERE company_id = ? AND deleted_at IS NULL
                ORDER BY channel_name, product_code NULLS FIRST, effective_from DESC
                """, companyId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("rows", enriched);
        result.put("feeSettings", feeSettings);
        result.put("basis", "채널 매출은 PlayAuto 주문 기준(수기입력 채널 별도 표기), 수수료는 주문 당시 이력 요율 적용");
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // 5. 비용 관리
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> getExpenses(Long companyId, YearMonth month) {
        List<Map<String, Object>> expenses = jdbcTemplate.queryForList("""
                SELECT id, expense_month, category, expense_type, amount, payment_date, vendor, memo
                FROM executive_operating_expense
                WHERE company_id = ? AND expense_month = ?
                ORDER BY amount DESC
                """, companyId, month.atDay(1));
        List<Map<String, Object>> recurring = jdbcTemplate.queryForList("""
                SELECT id, expense_name, category, amount, payment_day, cycle, start_month, end_month,
                       auto_renew, vendor, vat_included, manager_name, memo, is_active
                FROM cfo_recurring_expense
                WHERE company_id = ? AND deleted_at IS NULL
                ORDER BY is_active DESC, amount DESC
                """, companyId);

        // 이상 감지: 카테고리별 전월 대비 20% 이상 증가
        List<Map<String, Object>> anomalies = jdbcTemplate.queryForList("""
                SELECT cur.category,
                       cur.total AS current_amount,
                       prv.total AS previous_amount,
                       ROUND((cur.total - prv.total) * 100.0 / NULLIF(prv.total, 0), 1) AS change_pct
                FROM (
                    SELECT category, SUM(amount) AS total FROM executive_operating_expense
                    WHERE company_id = ? AND expense_month = ? GROUP BY category
                ) cur
                JOIN (
                    SELECT category, SUM(amount) AS total FROM executive_operating_expense
                    WHERE company_id = ? AND expense_month = ? GROUP BY category
                ) prv ON prv.category = cur.category
                WHERE prv.total > 0 AND cur.total >= prv.total * 1.2
                ORDER BY change_pct DESC
                """, companyId, month.atDay(1), companyId, month.minusMonths(1).atDay(1));

        // 예산 대비 (EXPENSE 예산)
        List<Map<String, Object>> budgetCompare = jdbcTemplate.queryForList("""
                SELECT b.category, b.amount AS budget_amount,
                       COALESCE(e.total, 0) AS actual_amount,
                       ROUND(COALESCE(e.total, 0) * 100.0 / NULLIF(b.amount, 0), 1) AS usage_pct
                FROM cfo_budget b
                LEFT JOIN (
                    SELECT category, SUM(amount) AS total FROM executive_operating_expense
                    WHERE company_id = ? AND expense_month = ? GROUP BY category
                ) e ON e.category = b.category
                WHERE b.company_id = ? AND b.deleted_at IS NULL
                  AND b.budget_type = 'EXPENSE' AND b.budget_month = ?
                ORDER BY usage_pct DESC NULLS LAST
                """, companyId, month.atDay(1), companyId, month.atDay(1));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("month", month.toString());
        result.put("expenses", expenses);
        result.put("recurring", recurring);
        result.put("anomalies", anomalies);
        result.put("budgetCompare", budgetCompare);
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // 6. 13주 현금흐름 예측
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> getCashflowForecast(Long companyId) {
        BigDecimal baseCash = FinanceCalculator.nvl(jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(balance), 0) FROM executive_cash_account WHERE company_id = ?
                """, BigDecimal.class, companyId));

        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        LocalDate horizon = weekStart.plusWeeks(13).minusDays(1);

        List<Map<String, Object>> flows = jdbcTemplate.queryForList("""
                SELECT flow_date, flow_type, category, counterparty, amount, status,
                       COALESCE(confidence_level, 'EXPECTED') AS confidence_level
                FROM executive_cash_flow
                WHERE company_id = ? AND status NOT IN ('CANCELLED', 'DONE')
                  AND flow_date BETWEEN ? AND ?
                ORDER BY flow_date
                """, companyId, today, horizon);

        List<Map<String, Object>> recurring = jdbcTemplate.queryForList("""
                SELECT expense_name, category, amount, payment_day
                FROM cfo_recurring_expense
                WHERE company_id = ? AND is_active = TRUE AND deleted_at IS NULL AND cycle = 'MONTHLY'
                  AND start_month <= ? AND (end_month IS NULL OR end_month >= ?)
                """, companyId, horizon, today);

        List<Map<String, Object>> debts = jdbcTemplate.queryForList("""
                SELECT lender, loan_name, monthly_payment, next_payment_date, maturity_date
                FROM executive_debt
                WHERE company_id = ? AND status <> 'CLOSED' AND monthly_payment > 0
                """, companyId);

        // 주차 버킷 초기화
        List<Map<String, Object>> weeks = new ArrayList<>();
        for (int i = 0; i < 13; i++) {
            LocalDate ws = weekStart.plusWeeks(i);
            Map<String, Object> week = new LinkedHashMap<>();
            week.put("weekIndex", i + 1);
            week.put("weekStart", ws.toString());
            week.put("weekEnd", ws.plusDays(6).toString());
            week.put("confirmedInflow", BigDecimal.ZERO);
            week.put("expectedInflow", BigDecimal.ZERO);
            week.put("outflow", BigDecimal.ZERO);
            week.put("items", new ArrayList<Map<String, Object>>());
            weeks.add(week);
        }

        java.util.function.BiConsumer<LocalDate, Map<String, Object>> addEvent = (date, event) -> {
            if (date == null || date.isBefore(weekStart) || date.isAfter(horizon)) return;
            int index = (int) ChronoUnit.WEEKS.between(weekStart, date);
            if (index < 0 || index >= 13) return;
            Map<String, Object> week = weeks.get(index);
            BigDecimal amount = dec(event.get("amount"));
            String type = String.valueOf(event.get("flow_type"));
            if ("INFLOW".equals(type)) {
                boolean confirmed = "CONFIRMED".equals(event.get("confidence_level"));
                String key = confirmed ? "confirmedInflow" : "expectedInflow";
                week.put(key, ((BigDecimal) week.get(key)).add(amount));
            } else {
                week.put("outflow", ((BigDecimal) week.get("outflow")).add(amount));
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) week.get("items");
            items.add(event);
        };

        for (Map<String, Object> flow : flows) {
            LocalDate date = LocalDate.parse(String.valueOf(flow.get("flow_date")));
            addEvent.accept(date, flow);
        }
        // 반복 고정비: 매월 결제일에 유출
        for (int m = 0; m < 4; m++) {
            YearMonth ym = YearMonth.from(weekStart).plusMonths(m);
            for (Map<String, Object> item : recurring) {
                int day = Math.min(((Number) item.get("payment_day")).intValue(), ym.lengthOfMonth());
                Map<String, Object> event = new LinkedHashMap<>();
                event.put("flow_date", ym.atDay(day).toString());
                event.put("flow_type", "OUTFLOW");
                event.put("category", item.get("category"));
                event.put("counterparty", item.get("expense_name"));
                event.put("amount", item.get("amount"));
                event.put("confidence_level", "CONFIRMED");
                event.put("source", "반복 고정비");
                addEvent.accept(ym.atDay(day), event);
            }
            for (Map<String, Object> debt : debts) {
                Object next = debt.get("next_payment_date");
                if (next == null) continue;
                LocalDate first = LocalDate.parse(String.valueOf(next));
                LocalDate payDate = first.plusMonths(m);
                Object maturity = debt.get("maturity_date");
                if (maturity != null && payDate.isAfter(LocalDate.parse(String.valueOf(maturity)))) continue;
                Map<String, Object> event = new LinkedHashMap<>();
                event.put("flow_date", payDate.toString());
                event.put("flow_type", "OUTFLOW");
                event.put("category", "대출 원리금");
                event.put("counterparty", debt.get("lender") + " " + debt.get("loan_name"));
                event.put("amount", debt.get("monthly_payment"));
                event.put("confidence_level", "CONFIRMED");
                event.put("source", "대출 상환");
                addEvent.accept(payDate, event);
            }
        }

        // 시나리오별 주말 잔액: 기준(확정 100% + 미확정 80%) / 낙관(100%) / 보수(미확정 50% + 유출 110%)
        BigDecimal baseBalance = baseCash;
        BigDecimal optimistic = baseCash;
        BigDecimal conservative = baseCash;
        for (Map<String, Object> week : weeks) {
            BigDecimal confirmedIn = (BigDecimal) week.get("confirmedInflow");
            BigDecimal expectedIn = (BigDecimal) week.get("expectedInflow");
            BigDecimal out = (BigDecimal) week.get("outflow");
            baseBalance = baseBalance.add(confirmedIn)
                    .add(expectedIn.multiply(BigDecimal.valueOf(0.8))).subtract(out);
            optimistic = optimistic.add(confirmedIn).add(expectedIn).subtract(out);
            conservative = conservative.add(confirmedIn)
                    .add(expectedIn.multiply(BigDecimal.valueOf(0.5)))
                    .subtract(out.multiply(BigDecimal.valueOf(1.1)));
            week.put("baseBalance", baseBalance.setScale(0, java.math.RoundingMode.HALF_UP));
            week.put("optimisticBalance", optimistic.setScale(0, java.math.RoundingMode.HALF_UP));
            week.put("conservativeBalance", conservative.setScale(0, java.math.RoundingMode.HALF_UP));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("baseCash", baseCash);
        result.put("weeks", weeks);
        result.put("scenarioBasis", Map.of(
                "base", "확정 입금 100% + 미확정 입금 80% 반영",
                "optimistic", "모든 예정 입금 100% 반영",
                "conservative", "미확정 입금 50% + 유출 110% 반영"));
        result.put("basis", "현금흐름표(executive_cash_flow) 예정 항목 + 반복 고정비 + 대출 월 상환액 기반. 손익과 분리된 현금 기준");
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // 7. 미수금 / 미지급금
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> getReceivablesPayables(Long companyId) {
        List<Map<String, Object>> receivables = jdbcTemplate.queryForList("""
                SELECT id, partner_name, manager_name, invoice_amount, paid_amount,
                       (invoice_amount - paid_amount) AS outstanding,
                       due_date, status, risk_level, memo,
                       GREATEST(0, CURRENT_DATE - due_date) AS days_overdue
                FROM executive_receivable
                WHERE company_id = ? AND (invoice_amount - paid_amount) > 0
                ORDER BY due_date
                """, companyId);
        Map<String, BigDecimal> aging = new LinkedHashMap<>();
        for (String bucket : List.of("기한 전", "0~30일", "31~60일", "61~90일", "91~180일", "181일 이상")) {
            aging.put(bucket, BigDecimal.ZERO);
        }
        for (Map<String, Object> row : receivables) {
            LocalDate due = LocalDate.parse(String.valueOf(row.get("due_date")));
            long realOverdue = ChronoUnit.DAYS.between(due, LocalDate.now());
            String bucket = FinanceCalculator.agingBucket(realOverdue);
            row.put("agingBucket", bucket);
            aging.merge(bucket, dec(row.get("outstanding")), BigDecimal::add);
        }
        List<Map<String, Object>> payables = jdbcTemplate.queryForList("""
                SELECT id, partner_name, amount, issue_date, due_date, tax_invoice_issued,
                       payment_confirmed, status,
                       GREATEST(0, CURRENT_DATE - due_date) AS days_overdue
                FROM partner_payment_ledger
                WHERE company_id = ? AND direction = 'PAYABLE' AND status = 'PENDING'
                ORDER BY due_date
                """, companyId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("receivables", receivables);
        result.put("aging", aging);
        result.put("payables", payables);
        result.put("totalReceivable", receivables.stream().map(r -> dec(r.get("outstanding")))
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        result.put("totalPayable", payables.stream().map(r -> dec(r.get("amount")))
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // 8. 대출·부채
    // ─────────────────────────────────────────────────────────────

    public Map<String, Object> getDebts(Long companyId) {
        List<Map<String, Object>> debts = jdbcTemplate.queryForList("""
                SELECT id, lender, loan_name, principal_balance, interest_rate,
                       monthly_payment, next_payment_date, maturity_date, status,
                       CASE WHEN maturity_date IS NOT NULL THEN maturity_date - CURRENT_DATE END AS days_to_maturity
                FROM executive_debt
                WHERE company_id = ? AND status <> 'CLOSED'
                ORDER BY next_payment_date
                """, companyId);
        BigDecimal totalDebt = BigDecimal.ZERO;
        BigDecimal totalMonthlyPayment = BigDecimal.ZERO;
        BigDecimal totalMonthlyInterest = BigDecimal.ZERO;
        for (Map<String, Object> debt : debts) {
            BigDecimal balance = dec(debt.get("principal_balance"));
            BigDecimal rate = dec(debt.get("interest_rate"));
            BigDecimal interest = FinanceCalculator.monthlyInterest(balance, rate);
            debt.put("monthlyInterestEst", interest);
            totalDebt = totalDebt.add(balance);
            totalMonthlyPayment = totalMonthlyPayment.add(dec(debt.get("monthly_payment")));
            totalMonthlyInterest = totalMonthlyInterest.add(FinanceCalculator.nvl(interest));
            Object days = debt.get("days_to_maturity");
            if (days != null) {
                long d = ((Number) days).longValue();
                debt.put("maturityAlert", d <= 30 ? "D-30 이내" : d <= 60 ? "D-60 이내" : d <= 90 ? "D-90 이내" : null);
            }
        }
        // 매출 대비 부채 비율 (최근 3개월 월평균 순매출)
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusMonths(3);
        BigDecimal revenue3m = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(COALESCE(pay_amt, 0) - COALESCE(cancel_amt, 0)), 0)
                FROM orders WHERE company_id = ?
                  AND COALESCE(pay_time, ord_time, wdate)::date BETWEEN ? AND ?
                """, BigDecimal.class, companyId, from, to);
        BigDecimal avgMonthlyRevenue = FinanceCalculator.nvl(revenue3m)
                .divide(BigDecimal.valueOf(3), 0, java.math.RoundingMode.HALF_UP);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("debts", debts);
        result.put("totalDebt", totalDebt);
        result.put("totalMonthlyPayment", totalMonthlyPayment);
        result.put("totalMonthlyInterestEst", totalMonthlyInterest);
        result.put("avgMonthlyRevenue", avgMonthlyRevenue);
        result.put("debtToMonthlyRevenuePct", FinanceCalculator.ratioPct(totalDebt,
                avgMonthlyRevenue.signum() == 0 ? null : avgMonthlyRevenue));
        result.put("basis", "월 이자는 잔액×연이율÷12 추정치. 원금/이자 분해 상환 스케줄은 금융기관 자료 등록 후 정밀화 필요");
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    // 9. 예산·목표 / 반복 고정비 / 수수료·원가 이력 CRUD
    // ─────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getBudgets(Long companyId, YearMonth month) {
        return jdbcTemplate.queryForList("""
                SELECT id, budget_month, budget_type, category, amount, memo
                FROM cfo_budget
                WHERE company_id = ? AND deleted_at IS NULL AND budget_month = ?
                ORDER BY budget_type, category
                """, companyId, month.atDay(1));
    }

    @Transactional
    public void saveBudget(Long companyId, String createdBy, YearMonth month, String budgetType,
                           String category, BigDecimal amount, String memo) {
        jdbcTemplate.update("""
                INSERT INTO cfo_budget (company_id, budget_month, budget_type, category, amount, memo, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (company_id, budget_month, budget_type, category)
                DO UPDATE SET amount = EXCLUDED.amount, memo = EXCLUDED.memo,
                              updated_at = NOW(), deleted_at = NULL
                """, companyId, month.atDay(1), budgetType,
                category == null || category.isBlank() ? "전체" : category, amount, memo, createdBy);
    }

    @Transactional
    public void deleteBudget(Long companyId, Long id) {
        jdbcTemplate.update("UPDATE cfo_budget SET deleted_at = NOW() WHERE company_id = ? AND id = ?",
                companyId, id);
    }

    @Transactional
    public void saveRecurringExpense(Long companyId, String createdBy, Map<String, Object> payload) {
        Object id = payload.get("id");
        if (id != null) {
            jdbcTemplate.update("""
                    UPDATE cfo_recurring_expense
                    SET expense_name = ?, category = ?, amount = ?, payment_day = ?, cycle = ?,
                        start_month = COALESCE(?::date, start_month), end_month = ?::date,
                        vendor = ?, manager_name = ?, memo = ?, is_active = ?, updated_at = NOW()
                    WHERE company_id = ? AND id = ? AND deleted_at IS NULL
                    """,
                    payload.get("expenseName"), payload.getOrDefault("category", "기타"),
                    dec(payload.get("amount")), payload.getOrDefault("paymentDay", 25),
                    payload.getOrDefault("cycle", "MONTHLY"),
                    payload.get("startMonth"), payload.get("endMonth"),
                    payload.get("vendor"), payload.get("managerName"), payload.get("memo"),
                    !Boolean.FALSE.equals(payload.get("isActive")),
                    companyId, ((Number) id).longValue());
        } else {
            jdbcTemplate.update("""
                    INSERT INTO cfo_recurring_expense
                        (company_id, expense_name, category, amount, payment_day, cycle,
                         start_month, end_month, vendor, manager_name, memo, is_active, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, COALESCE(?::date, DATE '2000-01-01'), ?::date, ?, ?, ?, ?, ?)
                    """,
                    companyId, payload.get("expenseName"), payload.getOrDefault("category", "기타"),
                    dec(payload.get("amount")), payload.getOrDefault("paymentDay", 25),
                    payload.getOrDefault("cycle", "MONTHLY"),
                    payload.get("startMonth"), payload.get("endMonth"),
                    payload.get("vendor"), payload.get("managerName"), payload.get("memo"),
                    !Boolean.FALSE.equals(payload.get("isActive")), createdBy);
        }
    }

    @Transactional
    public void deleteRecurringExpense(Long companyId, Long id) {
        jdbcTemplate.update("UPDATE cfo_recurring_expense SET deleted_at = NOW(), is_active = FALSE "
                + "WHERE company_id = ? AND id = ?", companyId, id);
    }

    /**
     * 수수료 이력 추가: 같은 채널×상품의 열린 구간(effective_to IS NULL)을 새 구간 시작 전날로 마감하고
     * 새 구간을 추가한다. 과거 구간은 절대 덮어쓰지 않는다.
     */
    @Transactional
    public void addFeeHistory(Long companyId, String createdBy, Map<String, Object> payload) {
        if (payload.get("channelName") == null || String.valueOf(payload.get("channelName")).isBlank()) {
            throw new IllegalArgumentException("채널명은 필수입니다.");
        }
        LocalDate effectiveFrom = LocalDate.parse(String.valueOf(
                payload.getOrDefault("effectiveFrom", LocalDate.now().toString())));
        String channelName = String.valueOf(payload.get("channelName"));
        Object productCode = payload.get("productCode");
        jdbcTemplate.update("""
                UPDATE cfo_channel_fee_history
                SET effective_to = ?::date - 1, updated_at = NOW()
                WHERE company_id = ? AND channel_name = ?
                  AND COALESCE(product_code, '') = COALESCE(?, '')
                  AND effective_to IS NULL AND deleted_at IS NULL AND effective_from < ?::date
                """, effectiveFrom, companyId, channelName, productCode, effectiveFrom);
        jdbcTemplate.update("""
                INSERT INTO cfo_channel_fee_history
                    (company_id, channel_name, product_code, fee_rate_pct, payment_fee_pct,
                     logistics_fee, storage_fee, vat_included, settlement_days, effective_from, memo, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, companyId, channelName, productCode,
                dec(payload.get("feeRatePct")), dec(payload.get("paymentFeePct")),
                dec(payload.get("logisticsFee")), dec(payload.get("storageFee")),
                !Boolean.FALSE.equals(payload.get("vatIncluded")),
                payload.get("settlementDays"), effectiveFrom, payload.get("memo"), createdBy);
    }

    @Transactional
    public void addCostHistory(Long companyId, String createdBy, Map<String, Object> payload) {
        if (payload.get("productCode") == null || String.valueOf(payload.get("productCode")).isBlank()) {
            throw new IllegalArgumentException("상품코드는 필수입니다.");
        }
        LocalDate effectiveFrom = LocalDate.parse(String.valueOf(
                payload.getOrDefault("effectiveFrom", LocalDate.now().toString())));
        String productCode = String.valueOf(payload.get("productCode"));
        Object channelName = payload.get("channelName");
        jdbcTemplate.update("""
                UPDATE cfo_product_cost_history
                SET effective_to = ?::date - 1, updated_at = NOW()
                WHERE company_id = ? AND product_code = ?
                  AND COALESCE(channel_name, '') = COALESCE(?, '')
                  AND effective_to IS NULL AND deleted_at IS NULL AND effective_from < ?::date
                """, effectiveFrom, companyId, productCode, channelName, effectiveFrom);
        jdbcTemplate.update("""
                INSERT INTO cfo_product_cost_history
                    (company_id, channel_name, product_code, sku_code, product_name,
                     production_cost, packaging_cost, vat_included, effective_from, source, memo, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', ?, ?)
                """, companyId, channelName, productCode, payload.get("skuCode"), payload.get("productName"),
                dec(payload.get("productionCost")), dec(payload.get("packagingCost")),
                Boolean.TRUE.equals(payload.get("vatIncluded")), effectiveFrom,
                payload.get("memo"), createdBy);
    }

    public List<Map<String, Object>> getCostHistory(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT id, channel_name, product_code, sku_code, product_name,
                       production_cost, packaging_cost, vat_included, effective_from, effective_to, source, memo
                FROM cfo_product_cost_history
                WHERE company_id = ? AND deleted_at IS NULL
                ORDER BY product_code, effective_from DESC
                """, companyId);
    }

    // ─────────────────────────────────────────────────────────────
    // 10. 재무 경보
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> getAlerts(Long companyId) {
        LocalDate today = LocalDate.now();
        String monthKey = YearMonth.now().toString();

        // 룰 1: 13주 예측에서 잔액이 음수가 되는 첫 주
        Map<String, Object> forecast = getCashflowForecast(companyId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> weeks = (List<Map<String, Object>>) forecast.get("weeks");
        for (Map<String, Object> week : weeks) {
            BigDecimal balance = (BigDecimal) week.get("conservativeBalance");
            if (balance != null && balance.signum() < 0) {
                int weekIndex = (Integer) week.get("weekIndex");
                String severity = weekIndex <= 4 ? "CRITICAL" : "WARNING";
                upsertAlert(companyId, severity, "CASH_SHORTAGE",
                        "cash-shortage:" + monthKey + ":" + weekIndex,
                        String.format("%d주차(%s)에 보수 시나리오 기준 현금 부족 예상", weekIndex, week.get("weekStart")),
                        "예정 유출 대비 확정 유입이 부족합니다.",
                        balance.abs(), "미수금 회수 독촉, 지출 시점 조정, 단기 자금 조달 검토");
                break;
            }
        }
        // 룰 2: 대출 만기 90/60/30일
        List<Map<String, Object>> maturing = jdbcTemplate.queryForList("""
                SELECT id, lender, loan_name, principal_balance, maturity_date,
                       maturity_date - CURRENT_DATE AS days_left
                FROM executive_debt
                WHERE company_id = ? AND status <> 'CLOSED'
                  AND maturity_date IS NOT NULL AND maturity_date - CURRENT_DATE BETWEEN 0 AND 90
                """, companyId);
        for (Map<String, Object> debt : maturing) {
            long daysLeft = ((Number) debt.get("days_left")).longValue();
            String severity = daysLeft <= 30 ? "CRITICAL" : "WARNING";
            upsertAlert(companyId, severity, "DEBT_MATURITY",
                    "debt-maturity:" + debt.get("id") + ":" + monthKey,
                    String.format("대출 만기 D-%d: %s %s", daysLeft, debt.get("lender"), debt.get("loan_name")),
                    "만기 연장 또는 상환 자금 확보가 필요합니다.",
                    dec(debt.get("principal_balance")), "금융기관과 연장 협의 또는 상환 계획 수립");
        }
        // 룰 3: 장기 연체 미수금 (91일+)
        List<Map<String, Object>> overdue = jdbcTemplate.queryForList("""
                SELECT partner_name, SUM(invoice_amount - paid_amount) AS outstanding
                FROM executive_receivable
                WHERE company_id = ? AND (invoice_amount - paid_amount) > 0
                  AND CURRENT_DATE - due_date > 90
                GROUP BY partner_name
                """, companyId);
        for (Map<String, Object> row : overdue) {
            upsertAlert(companyId, "CRITICAL", "RECEIVABLE_LONG_OVERDUE",
                    "receivable-overdue:" + row.get("partner_name") + ":" + monthKey,
                    String.format("%s 미수금 91일 이상 연체", row.get("partner_name")),
                    "장기 연체는 손실 처리 위험이 있습니다.",
                    dec(row.get("outstanding")), "회수 계획 수립, 필요 시 법적 조치 검토");
        }
        // 룰 4: 이번 달 영업이익 적자
        YearMonth thisMonth = YearMonth.now();
        Map<String, Object> monthFin = buildPeriodFinancials(companyId, thisMonth.atDay(1), today);
        BigDecimal operating = (BigDecimal) monthFin.get("operatingProfit");
        if (Boolean.TRUE.equals(monthFin.get("dataAvailable")) && operating != null && operating.signum() < 0) {
            upsertAlert(companyId, "CRITICAL", "OPERATING_LOSS",
                    "operating-loss:" + monthKey,
                    "이번 달 영업이익 적자 진행 중",
                    "매출 대비 원가·변동비·고정비가 과다합니다.",
                    operating.abs(), "적자 상품 판매 축소, 고정비 점검, 채널 수수료 재협상");
        }
        // 룰 5: 비용 급증 (전월 대비 20%↑)
        List<Map<String, Object>> costSpikes = jdbcTemplate.queryForList("""
                SELECT cur.category, cur.total AS current_amount, prv.total AS previous_amount
                FROM (SELECT category, SUM(amount) AS total FROM executive_operating_expense
                      WHERE company_id = ? AND expense_month = ? GROUP BY category) cur
                JOIN (SELECT category, SUM(amount) AS total FROM executive_operating_expense
                      WHERE company_id = ? AND expense_month = ? GROUP BY category) prv
                  ON prv.category = cur.category
                WHERE prv.total > 0 AND cur.total >= prv.total * 1.2
                """, companyId, thisMonth.atDay(1), companyId, thisMonth.minusMonths(1).atDay(1));
        for (Map<String, Object> spike : costSpikes) {
            upsertAlert(companyId, "WARNING", "EXPENSE_SPIKE",
                    "expense-spike:" + spike.get("category") + ":" + monthKey,
                    String.format("%s 비용 전월 대비 20%% 이상 증가", spike.get("category")),
                    String.format("전월 %,d원 → 이번 달 %,d원",
                            dec(spike.get("previous_amount")).longValue(),
                            dec(spike.get("current_amount")).longValue()),
                    dec(spike.get("current_amount")).subtract(dec(spike.get("previous_amount"))),
                    "비용 증가 원인 확인 및 중복 입력 여부 점검");
        }
        // 룰 6: 기회 — 런웨이 개선
        BigDecimal lastWeekBase = weeks.isEmpty() ? null : (BigDecimal) weeks.get(weeks.size() - 1).get("baseBalance");
        BigDecimal baseCash = (BigDecimal) forecast.get("baseCash");
        if (lastWeekBase != null && baseCash != null && baseCash.signum() > 0
                && lastWeekBase.compareTo(baseCash) > 0) {
            upsertAlert(companyId, "OPPORTUNITY", "CASH_GROWING",
                    "cash-growing:" + monthKey,
                    "13주 기준 시나리오에서 현금이 순증 예상",
                    "예정 유입이 유출을 상회합니다.",
                    lastWeekBase.subtract(baseCash), "잉여 현금의 대출 조기상환 또는 생산 투자 검토");
        }

        List<Map<String, Object>> alerts = jdbcTemplate.queryForList("""
                SELECT id, alert_date, severity, rule_key, title, description, cause,
                       impact_amount, recommendation, assignee, status, resolved_at
                FROM cfo_alert
                WHERE company_id = ? AND status IN ('OPEN', 'ACK')
                ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END, created_at DESC
                """, companyId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("alerts", alerts);
        return result;
    }

    private void upsertAlert(Long companyId, String severity, String ruleKey, String dedupeKey,
                             String title, String cause, BigDecimal impact, String recommendation) {
        jdbcTemplate.update("""
                INSERT INTO cfo_alert (company_id, severity, rule_key, dedupe_key, title, cause,
                                       impact_amount, recommendation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (company_id, dedupe_key) DO UPDATE
                SET severity = EXCLUDED.severity, title = EXCLUDED.title, cause = EXCLUDED.cause,
                    impact_amount = EXCLUDED.impact_amount, recommendation = EXCLUDED.recommendation,
                    updated_at = NOW()
                """, companyId, severity, ruleKey, dedupeKey, title, cause, impact, recommendation);
    }

    @Transactional
    public void updateAlertStatus(Long companyId, Long id, String status, String assignee) {
        jdbcTemplate.update("""
                UPDATE cfo_alert
                SET status = ?, assignee = COALESCE(?, assignee),
                    resolved_at = CASE WHEN ? IN ('RESOLVED', 'DISMISSED') THEN NOW() ELSE resolved_at END,
                    updated_at = NOW()
                WHERE company_id = ? AND id = ?
                """, status, assignee, status, companyId, id);
    }

    // ─────────────────────────────────────────────────────────────
    // 11. CSV 업로드 (예산 / 반복 고정비 / 수수료 이력 / 원가 이력)
    // ─────────────────────────────────────────────────────────────

    /**
     * CSV 텍스트를 파싱해 검증 결과를 반환하고, dryRun=false 이면 저장한다.
     * 형식(헤더 제외):
     *  - budget:    월(yyyy-MM),유형,카테고리,금액,메모
     *  - recurring: 비용명,카테고리,금액,결제일,시작월(yyyy-MM),종료월(옵션),거래처,메모
     *  - fee:       채널명,상품코드(옵션),판매수수료%,결제수수료%,건당물류비,개당보관비,적용시작일(yyyy-MM-dd),메모
     *  - cost:      상품코드,채널명(옵션),SKU,상품명,제조원가,포장비,적용시작일(yyyy-MM-dd),메모
     */
    @Transactional
    public Map<String, Object> uploadCsv(Long companyId, String createdBy, String type,
                                         String csvText, boolean dryRun) {
        List<String> errors = new ArrayList<>();
        List<Map<String, Object>> preview = new ArrayList<>();
        String[] lines = csvText.replace("﻿", "").split("\r?\n");
        int saved = 0;
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isEmpty()) continue;
            if (i == 0 && !line.matches(".*\\d.*")) continue; // 헤더로 판단되면 건너뜀
            String[] cols = line.split(",", -1);
            try {
                switch (type) {
                    case "budget" -> {
                        require(cols, 4, "월,유형,카테고리,금액");
                        YearMonth month = YearMonth.parse(cols[0].trim());
                        BigDecimal amount = new BigDecimal(cols[3].trim().replace("\"", "").replace(",", ""));
                        preview.add(Map.of("month", month.toString(), "type", cols[1].trim(),
                                "category", cols[2].trim(), "amount", amount));
                        if (!dryRun) {
                            saveBudget(companyId, createdBy, month, cols[1].trim(), cols[2].trim(),
                                    amount, cols.length > 4 ? cols[4].trim() : null);
                            saved++;
                        }
                    }
                    case "recurring" -> {
                        require(cols, 4, "비용명,카테고리,금액,결제일");
                        Map<String, Object> payload = new HashMap<>();
                        payload.put("expenseName", cols[0].trim());
                        payload.put("category", cols[1].trim());
                        payload.put("amount", new BigDecimal(cols[2].trim().replace(",", "")));
                        payload.put("paymentDay", Integer.parseInt(cols[3].trim()));
                        if (cols.length > 4 && !cols[4].isBlank()) payload.put("startMonth", cols[4].trim() + "-01");
                        if (cols.length > 5 && !cols[5].isBlank()) payload.put("endMonth", cols[5].trim() + "-01");
                        if (cols.length > 6) payload.put("vendor", cols[6].trim());
                        if (cols.length > 7) payload.put("memo", cols[7].trim());
                        preview.add(payload);
                        if (!dryRun) {
                            saveRecurringExpense(companyId, createdBy, payload);
                            saved++;
                        }
                    }
                    case "fee" -> {
                        require(cols, 3, "채널명,상품코드,판매수수료%");
                        Map<String, Object> payload = new HashMap<>();
                        payload.put("channelName", cols[0].trim());
                        if (!cols[1].isBlank()) payload.put("productCode", cols[1].trim());
                        payload.put("feeRatePct", new BigDecimal(cols[2].trim()));
                        if (cols.length > 3 && !cols[3].isBlank()) payload.put("paymentFeePct", new BigDecimal(cols[3].trim()));
                        if (cols.length > 4 && !cols[4].isBlank()) payload.put("logisticsFee", new BigDecimal(cols[4].trim().replace(",", "")));
                        if (cols.length > 5 && !cols[5].isBlank()) payload.put("storageFee", new BigDecimal(cols[5].trim().replace(",", "")));
                        if (cols.length > 6 && !cols[6].isBlank()) payload.put("effectiveFrom", cols[6].trim());
                        if (cols.length > 7) payload.put("memo", cols[7].trim());
                        preview.add(payload);
                        if (!dryRun) {
                            addFeeHistory(companyId, createdBy, payload);
                            saved++;
                        }
                    }
                    case "cost" -> {
                        require(cols, 5, "상품코드,채널명,SKU,상품명,제조원가");
                        Map<String, Object> payload = new HashMap<>();
                        payload.put("productCode", cols[0].trim());
                        if (!cols[1].isBlank()) payload.put("channelName", cols[1].trim());
                        payload.put("skuCode", cols[2].trim());
                        payload.put("productName", cols[3].trim());
                        payload.put("productionCost", new BigDecimal(cols[4].trim().replace(",", "")));
                        if (cols.length > 5 && !cols[5].isBlank()) payload.put("packagingCost", new BigDecimal(cols[5].trim().replace(",", "")));
                        if (cols.length > 6 && !cols[6].isBlank()) payload.put("effectiveFrom", cols[6].trim());
                        if (cols.length > 7) payload.put("memo", cols[7].trim());
                        preview.add(payload);
                        if (!dryRun) {
                            addCostHistory(companyId, createdBy, payload);
                            saved++;
                        }
                    }
                    default -> throw new IllegalArgumentException("지원하지 않는 업로드 유형: " + type);
                }
            } catch (Exception e) {
                errors.add((i + 1) + "행: " + e.getMessage());
            }
        }
        if (!dryRun && !errors.isEmpty()) {
            throw new IllegalStateException("검증 오류가 있어 저장하지 않았습니다: " + String.join(" / ", errors));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dryRun", dryRun);
        result.put("rowCount", preview.size());
        result.put("savedCount", saved);
        result.put("errors", errors);
        result.put("preview", preview.subList(0, Math.min(preview.size(), 20)));
        return result;
    }

    private void require(String[] cols, int min, String format) {
        if (cols.length < min) {
            throw new IllegalArgumentException("필수 컬럼 누락 (형식: " + format + ")");
        }
    }
}
