package naeil.dashboard.service;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ExecutiveDashboardService {

    private final JdbcTemplate jdbcTemplate;
    private final PlayAutoSyncService playAutoSyncService;
    private static final int PRODUCT_FORECAST_MONTHS = 12;
    private static final List<BigDecimal> PRODUCT_FORECAST_GROWTH_FACTORS = List.of(
            BigDecimal.valueOf(0.35),
            BigDecimal.valueOf(0.55),
            BigDecimal.valueOf(0.75),
            BigDecimal.valueOf(0.95),
            BigDecimal.valueOf(1.10),
            BigDecimal.valueOf(1.25),
            BigDecimal.valueOf(1.40),
            BigDecimal.valueOf(1.55),
            BigDecimal.valueOf(1.70),
            BigDecimal.valueOf(1.85),
            BigDecimal.valueOf(2.00),
            BigDecimal.valueOf(2.15)
    );

    private record ResourceDefinition(String tableName, Set<String> columns) {}

    private static final Map<String, ResourceDefinition> RESOURCE_DEFINITIONS = Map.ofEntries(
            Map.entry("cash-accounts", new ResourceDefinition("executive_cash_account", Set.of(
                    "company_id", "bank_name", "account_name", "account_number", "balance", "as_of_date", "status"
            ))),
            Map.entry("cash-flows", new ResourceDefinition("executive_cash_flow", Set.of(
                    "company_id", "flow_date", "flow_type", "category", "counterparty", "amount", "status",
                    "confidence_level", "recurring_rule", "source_type", "source_key", "memo"
            ))),
            Map.entry("product-profits", new ResourceDefinition("executive_product_profit", Set.of(
                    "company_id", "product_name", "sku", "category", "production_cost", "supply_price", "selling_price",
                    "platform_fee", "ad_cost", "logistics_cost", "expected_net_profit", "margin_rate", "sold_quantity",
                    "stock_quantity", "safe_stock", "expiry_date", "status", "bundle_quantity", "total_weight_g",
                    "consumer_price", "discount_amount", "final_discount_price", "unit_selling_price",
                    "customer_shipping_fee", "gross_sales", "marketing_cost", "operating_admin_cost",
                    "storage_cost", "total_admin_cost", "gross_profit", "gross_profit_rate", "note",
                    "package_composition", "export_cost_ex_vat", "export_supply_price_5000",
                    "export_supply_price_10000", "export_supply_price_20000", "daily_production_moq",
                    "carton_quantity", "pallet_quantity", "manufacture_date", "expiry_check_date",
                    "supplied_materials", "issue_text"
            ))),
            Map.entry("product-forecasts", new ResourceDefinition("executive_product_forecast", Set.of(
                    "company_id", "product_name", "brand_name", "category", "npd_stage", "launch_month",
                    "forecast_months", "expected_monthly_units", "expected_selling_price",
                    "unit_production_cost", "platform_fee_rate", "ad_cost_rate", "operating_admin_rate",
                    "logistics_cost_per_unit", "expected_sales", "expected_gross_profit",
                    "expected_gross_margin_rate", "expected_operating_profit",
                    "expected_operating_margin_rate", "memo"
            ))),
            Map.entry("channel-sales", new ResourceDefinition("executive_channel_performance", Set.of(
                    "company_id", "channel_name", "sales_amount", "ad_cost", "roas", "margin_rate", "order_count",
                    "average_order_value", "net_profit", "report_month", "source_type", "source_key"
            ))),
            Map.entry("consulting-revenues", new ResourceDefinition("executive_consulting_revenue", Set.of(
                    "company_id", "client_name", "project_name", "consulting_type", "contract_amount",
                    "paid_amount", "expected_payment_date", "start_date", "end_date", "labor_cost",
                    "outsourcing_cost", "other_cost", "total_cost", "gross_profit", "operating_profit",
                    "operating_margin_rate", "status", "owner_name", "memo"
            ))),
            Map.entry("receivables", new ResourceDefinition("executive_receivable", Set.of(
                    "company_id", "partner_name", "manager_name", "contact", "invoice_amount", "paid_amount",
                    "due_date", "status", "risk_level", "memo"
            ))),
            Map.entry("operating-expenses", new ResourceDefinition("executive_operating_expense", Set.of(
                    "company_id", "expense_month", "category", "expense_type", "amount", "payment_date", "vendor", "memo"
            ))),
            Map.entry("debts", new ResourceDefinition("executive_debt", Set.of(
                    "company_id", "lender", "loan_name", "principal_balance", "interest_rate", "monthly_payment",
                    "next_payment_date", "maturity_date", "status"
            ))),
            Map.entry("export-pipeline", new ResourceDefinition("executive_export_pipeline", Set.of(
                    "company_id", "country", "buyer_name", "stage", "expected_moq", "expected_sales",
                    "expected_payment_date", "certification_required", "current_status", "next_action",
                    "owner_name", "memo"
            ))),
            Map.entry("export-supply-prices", new ResourceDefinition("executive_export_supply_price", Set.of(
                    "company_id", "country", "product_name", "scenario_label", "moq", "consumer_price",
                    "production_cost_ex_vat", "production_cost_inc_vat", "ad_cost", "sales_admin_cost",
                    "logistics_cost", "domestic_admin_cost", "operating_profit_per_unit", "export_supply_price_krw",
                    "supply_price_usd", "domestic_convenience_supply_price", "zero_store_supply_price",
                    "expected_sales", "total_production_cost", "operating_profit_total", "operating_profit_rate",
                    "upfront_cost", "pipeline_stage", "memo"
            ))),
            Map.entry("ad-performance", new ResourceDefinition("executive_ad_performance", Set.of(
                    "company_id", "ad_channel", "ad_cost", "click_count", "cpa", "roas", "conversion_rate",
                    "sales_amount", "net_profit", "report_month"
            ))),
            Map.entry("issues", new ResourceDefinition("executive_issue_log", Set.of(
                    "company_id", "issue_date", "severity", "category", "title", "description", "status"
            )))
    );

    private static final Set<String> DATE_COLUMNS = Set.of(
            "as_of_date",
            "flow_date",
            "expiry_date",
            "manufacture_date",
            "expiry_check_date",
            "launch_month",
            "report_month",
            "due_date",
            "start_date",
            "end_date",
            "expense_month",
            "payment_date",
            "next_payment_date",
            "maturity_date",
            "expected_payment_date",
            "issue_date"
    );

    private static final Set<String> DECIMAL_COLUMNS = Set.of(
            "balance",
            "amount",
            "production_cost",
            "supply_price",
            "selling_price",
            "platform_fee",
            "ad_cost",
            "logistics_cost",
            "expected_net_profit",
            "margin_rate",
            "sales_amount",
            "roas",
            "average_order_value",
            "net_profit",
            "invoice_amount",
            "paid_amount",
            "principal_balance",
            "interest_rate",
            "monthly_payment",
            "expected_sales",
            "cpa",
            "conversion_rate",
            "consumer_price",
            "production_cost_ex_vat",
            "production_cost_inc_vat",
            "sales_admin_cost",
            "domestic_admin_cost",
            "operating_profit_per_unit",
            "export_supply_price_krw",
            "supply_price_usd",
            "domestic_convenience_supply_price",
            "zero_store_supply_price",
            "total_production_cost",
            "operating_profit_total",
            "operating_profit_rate",
            "upfront_cost",
            "discount_amount",
            "final_discount_price",
            "unit_selling_price",
            "customer_shipping_fee",
            "gross_sales",
            "marketing_cost",
            "operating_admin_cost",
            "storage_cost",
            "total_admin_cost",
            "gross_profit",
            "gross_profit_rate",
            "export_cost_ex_vat",
            "export_supply_price_5000",
            "export_supply_price_10000",
            "export_supply_price_20000",
            "expected_selling_price",
            "unit_production_cost",
            "platform_fee_rate",
            "ad_cost_rate",
            "operating_admin_rate",
            "expected_gross_profit",
            "expected_gross_margin_rate",
            "expected_operating_profit",
            "expected_operating_margin_rate",
            "logistics_cost_per_unit",
            "contract_amount",
            "labor_cost",
            "outsourcing_cost",
            "other_cost",
            "total_cost",
            "operating_profit",
            "operating_margin_rate"
    );

    private static final Set<String> INTEGER_COLUMNS = Set.of(
            "sold_quantity",
            "stock_quantity",
            "safe_stock",
            "order_count",
            "expected_moq",
            "click_count",
            "moq",
            "bundle_quantity",
            "total_weight_g",
            "daily_production_moq",
            "pallet_quantity",
            "forecast_months",
            "expected_monthly_units"
    );

    public Map<String, Object> getSummary(Long companyId) {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);

        Map<String, Object> sales = jdbcTemplate.queryForMap("""
                WITH channel_sales AS (
                    SELECT
                        COALESCE(SUM(sales_amount), 0) AS sales_amount,
                        COALESCE(SUM(net_profit), 0) AS operating_profit,
                        COALESCE(SUM(ad_cost), 0) AS ad_cost,
                        COALESCE(SUM(order_count), 0) AS order_count
                    FROM executive_channel_performance
                    WHERE company_id = ? AND report_month = date_trunc('month', CURRENT_DATE)::date
                ),
                consulting_sales AS (
                    SELECT
                        COALESCE(SUM(paid_amount), 0) AS sales_amount,
                        COALESCE(SUM(
                            CASE
                                WHEN contract_amount = 0 THEN 0
                                ELSE paid_amount
                                    - ((labor_cost + outsourcing_cost + other_cost) * (paid_amount / contract_amount))
                            END
                        ), 0) AS operating_profit,
                        COALESCE(SUM(contract_amount), 0) AS expected_sales_amount,
                        COALESCE(SUM(contract_amount - labor_cost - outsourcing_cost - other_cost), 0) AS expected_operating_profit
                    FROM executive_consulting_revenue
                    WHERE company_id = ?
                      AND status <> 'CANCELLED'
                      AND date_trunc('month', COALESCE(expected_payment_date, start_date, CURRENT_DATE))::date = date_trunc('month', CURRENT_DATE)::date
                )
                SELECT
                    channel_sales.sales_amount + consulting_sales.sales_amount AS month_sales,
                    channel_sales.operating_profit + consulting_sales.operating_profit AS month_operating_profit,
                    channel_sales.ad_cost AS month_ad_cost,
                    CASE
                        WHEN channel_sales.sales_amount + consulting_sales.sales_amount = 0 THEN 0
                        ELSE ROUND(
                            (channel_sales.operating_profit + consulting_sales.operating_profit)
                            / (channel_sales.sales_amount + consulting_sales.sales_amount) * 100,
                            2
                        )
                    END AS average_margin_rate,
                    channel_sales.order_count AS month_order_count,
                    channel_sales.sales_amount AS channel_month_sales,
                    consulting_sales.sales_amount AS consulting_month_sales,
                    channel_sales.operating_profit AS channel_month_operating_profit,
                    consulting_sales.operating_profit AS consulting_month_operating_profit,
                    consulting_sales.expected_sales_amount AS consulting_expected_month_sales,
                    consulting_sales.expected_operating_profit AS consulting_expected_month_operating_profit,
                    channel_sales.ad_cost AS channel_month_ad_cost
                FROM channel_sales, consulting_sales
                """, companyId, companyId);

        Map<String, Object> advertising = jdbcTemplate.queryForMap("""
                WITH ad_performance AS (
                    SELECT COALESCE(SUM(ad_cost), 0) AS amount
                    FROM executive_ad_performance
                    WHERE company_id = ?
                      AND report_month = date_trunc('month', CURRENT_DATE)::date
                ),
                ad_expense AS (
                    SELECT COALESCE(SUM(amount), 0) AS amount
                    FROM executive_operating_expense
                    WHERE company_id = ?
                      AND expense_month = date_trunc('month', CURRENT_DATE)::date
                      AND category ILIKE '%광고%'
                )
                SELECT
                    ad_performance.amount + ad_expense.amount AS entered_month_ad_cost
                FROM ad_performance, ad_expense
                """, companyId, companyId);

        Map<String, Object> previousSales = jdbcTemplate.queryForMap("""
                WITH channel_sales AS (
                    SELECT COALESCE(SUM(sales_amount), 0) AS sales_amount
                    FROM executive_channel_performance
                    WHERE company_id = ? AND report_month = (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
                ),
                consulting_sales AS (
                    SELECT COALESCE(SUM(paid_amount), 0) AS sales_amount
                    FROM executive_consulting_revenue
                    WHERE company_id = ?
                      AND status <> 'CANCELLED'
                      AND date_trunc('month', COALESCE(expected_payment_date, start_date, CURRENT_DATE))::date =
                          (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
                )
                SELECT channel_sales.sales_amount + consulting_sales.sales_amount AS previous_month_sales
                FROM channel_sales, consulting_sales
                """, companyId, companyId);

        Map<String, Object> cash = jdbcTemplate.queryForMap("""
                SELECT
                    COALESCE(SUM(balance), 0) AS account_balance,
                    COALESCE(SUM(balance), 0) AS cash_balance,
                    COUNT(*) FILTER (WHERE status <> 'NORMAL') AS watched_accounts
                FROM executive_cash_account
                WHERE company_id = ?
                """, companyId);

        Map<String, Object> receivable = jdbcTemplate.queryForMap("""
                WITH trade_receivable AS (
                    SELECT
                        COALESCE(SUM(invoice_amount - paid_amount), 0) AS receivable_total,
                        COUNT(*) FILTER (WHERE risk_level IN ('HIGH', 'CRITICAL')) AS risky_count
                    FROM executive_receivable
                    WHERE company_id = ?
                ),
                consulting_receivable AS (
                    SELECT
                        COALESCE(SUM(GREATEST(contract_amount - paid_amount, 0)), 0) AS receivable_total,
                        COUNT(*) FILTER (
                            WHERE GREATEST(contract_amount - paid_amount, 0) > 0
                              AND expected_payment_date < CURRENT_DATE
                        ) AS risky_count
                    FROM executive_consulting_revenue
                    WHERE company_id = ? AND status <> 'CANCELLED'
                )
                SELECT
                    trade_receivable.receivable_total + consulting_receivable.receivable_total AS receivable_total,
                    trade_receivable.risky_count + consulting_receivable.risky_count AS risky_receivable_count,
                    trade_receivable.receivable_total AS trade_receivable_total,
                    consulting_receivable.receivable_total AS consulting_receivable_total,
                    trade_receivable.risky_count AS trade_risky_receivable_count,
                    consulting_receivable.risky_count AS consulting_risky_receivable_count
                FROM trade_receivable, consulting_receivable
                """, companyId, companyId);

        Map<String, Object> inventory = jdbcTemplate.queryForMap("""
                SELECT
                    COALESCE(SUM(production_cost * stock_quantity), 0) AS inventory_value,
                    COUNT(*) FILTER (
                        WHERE stock_quantity <= COALESCE(NULLIF(safe_stock, 0), 3000)
                           OR margin_rate < 10
                           OR stock_quantity >= COALESCE(NULLIF(safe_stock, 0), 3000) * 3
                    ) AS inventory_risk_count
                FROM executive_product_profit
                WHERE company_id = ?
                """, companyId);

        Map<String, Object> expense = jdbcTemplate.queryForMap("""
                SELECT
                    COALESCE(SUM(amount) FILTER (WHERE expense_type = 'FIXED'), 0) AS month_fixed_cost,
                    COALESCE(SUM(amount), 0) AS month_total_cost
                FROM executive_operating_expense
                WHERE company_id = ? AND expense_month = date_trunc('month', CURRENT_DATE)::date
                """, companyId);

        Map<String, Object> debt = jdbcTemplate.queryForMap("""
                SELECT COALESCE(SUM(principal_balance), 0) AS debt_balance
                FROM executive_debt
                WHERE company_id = ?
                """, companyId);

        Map<String, Object> todayFlow = jdbcTemplate.queryForMap("""
                SELECT
                    COALESCE(SUM(amount) FILTER (WHERE flow_type = 'INFLOW'), 0) AS today_inflow,
                    COALESCE(SUM(amount) FILTER (WHERE flow_type = 'OUTFLOW'), 0) AS today_outflow
                FROM executive_cash_flow
                WHERE company_id = ? AND flow_date = CURRENT_DATE
                """, companyId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("companyName", "주식회사 내일그룹");
        result.put("today", today);
        result.put("monthStart", monthStart);
        result.put("todaySales", todayFlow.get("today_inflow"));
        result.putAll(sales);
        result.putAll(advertising);
        BigDecimal channelAdCost = decimalValue(result.get("channel_month_ad_cost"));
        BigDecimal enteredAdCost = decimalValue(result.get("entered_month_ad_cost"));
        result.put("month_ad_cost", moneyValue(channelAdCost.max(enteredAdCost)));
        result.putAll(previousSales);
        result.putAll(cash);
        result.putAll(receivable);
        result.putAll(inventory);
        result.putAll(expense);
        result.putAll(debt);
        result.putAll(todayFlow);
        result.put("cashRiskStatus", getCashRiskStatus(companyId));
        result.put("expectedCashShortageDate", getExpectedCashShortageDate(companyId));
        result.put("urgentIssueCount", countUrgentIssues(companyId));
        return result;
    }

    public List<Map<String, Object>> getMonthlySales(Long companyId) {
        return jdbcTemplate.queryForList("""
                WITH channel_monthly AS (
                    SELECT
                        report_month,
                        SUM(sales_amount) AS sales_amount,
                        SUM(net_profit) AS operating_profit
                    FROM executive_channel_performance
                    WHERE company_id = ?
                    GROUP BY report_month
                ),
                consulting_monthly AS (
                    SELECT
                        date_trunc('month', COALESCE(expected_payment_date, start_date, CURRENT_DATE))::date AS report_month,
                        SUM(paid_amount) AS sales_amount,
                        SUM(
                            CASE
                                WHEN contract_amount = 0 THEN 0
                                ELSE paid_amount
                                    - ((labor_cost + outsourcing_cost + other_cost) * (paid_amount / contract_amount))
                            END
                        ) AS operating_profit,
                        SUM(contract_amount) AS expected_sales_amount
                    FROM executive_consulting_revenue
                    WHERE company_id = ? AND status <> 'CANCELLED'
                    GROUP BY date_trunc('month', COALESCE(expected_payment_date, start_date, CURRENT_DATE))::date
                ),
                combined AS (
                    SELECT
                        COALESCE(c.report_month, s.report_month) AS report_month,
                        COALESCE(c.sales_amount, 0) AS channel_sales_amount,
                        COALESCE(s.sales_amount, 0) AS consulting_sales_amount,
                        COALESCE(c.operating_profit, 0) AS channel_operating_profit,
                        COALESCE(s.operating_profit, 0) AS consulting_operating_profit,
                        COALESCE(s.expected_sales_amount, 0) AS consulting_expected_sales_amount
                    FROM channel_monthly c
                    FULL OUTER JOIN consulting_monthly s ON s.report_month = c.report_month
                )
                SELECT
                    report_month,
                    channel_sales_amount + consulting_sales_amount AS sales_amount,
                    channel_operating_profit + consulting_operating_profit AS operating_profit,
                    channel_sales_amount,
                    consulting_sales_amount,
                    channel_operating_profit,
                    consulting_operating_profit,
                    consulting_expected_sales_amount
                FROM combined
                ORDER BY report_month
                """, companyId, companyId);
    }

    public Map<String, Object> getCashFlow(Long companyId) {
        Map<String, Object> totals = jdbcTemplate.queryForMap("""
                SELECT
                    COALESCE(SUM(amount) FILTER (WHERE flow_date = CURRENT_DATE AND flow_type = 'INFLOW'), 0) AS today_inflow,
                    COALESCE(SUM(amount) FILTER (WHERE flow_date = CURRENT_DATE AND flow_type = 'OUTFLOW'), 0) AS today_outflow,
                    COALESCE(SUM(amount) FILTER (WHERE flow_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 day' AND flow_type = 'INFLOW'), 0) AS week_inflow,
                    COALESCE(SUM(amount) FILTER (WHERE flow_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 day' AND flow_type = 'OUTFLOW'), 0) AS week_outflow,
                    COALESCE(SUM(amount) FILTER (WHERE date_trunc('month', flow_date) = date_trunc('month', CURRENT_DATE) AND flow_type = 'INFLOW'), 0) AS month_inflow,
                    COALESCE(SUM(amount) FILTER (WHERE date_trunc('month', flow_date) = date_trunc('month', CURRENT_DATE) AND flow_type = 'OUTFLOW'), 0) AS month_outflow
                FROM executive_cash_flow
                WHERE company_id = ?
                """, companyId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totals", totals);
        result.put("expectedCashShortageDate", getExpectedCashShortageDate(companyId));
        result.put("accounts", queryAccounts(companyId));
        result.put("monthlyFlow", jdbcTemplate.queryForList("""
                SELECT
                    date_trunc('month', flow_date)::date AS month,
                    COALESCE(SUM(amount) FILTER (WHERE flow_type = 'INFLOW'), 0) AS inflow,
                    COALESCE(SUM(amount) FILTER (WHERE flow_type = 'OUTFLOW'), 0) AS outflow
                FROM executive_cash_flow
                WHERE company_id = ?
                GROUP BY date_trunc('month', flow_date)::date
                ORDER BY month
                """, companyId));
        result.put("inflows", jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_cash_flow
                WHERE company_id = ? AND flow_type = 'INFLOW'
                ORDER BY flow_date, amount DESC
                """, companyId));
        result.put("outflows", jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_cash_flow
                WHERE company_id = ? AND flow_type = 'OUTFLOW'
                ORDER BY flow_date, amount DESC
                """, companyId));
        result.put("receivables", getReceivables(companyId));
        result.put("dailyProjection", getDailyCashProjection(companyId));
        result.put("upcomingOutflows", jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_cash_flow
                WHERE company_id = ? AND flow_type = 'OUTFLOW' AND flow_date >= CURRENT_DATE
                ORDER BY flow_date, amount DESC
                LIMIT 8
                """, companyId));
        result.put("delayedInflows", jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_cash_flow
                WHERE company_id = ?
                  AND flow_type = 'INFLOW'
                  AND flow_date < CURRENT_DATE
                  AND status NOT IN ('DONE', 'CANCELLED')
                ORDER BY flow_date, amount DESC
                """, companyId));
        return result;
    }

    public Map<String, Object> importOnlineSettlements(Long companyId, LocalDate startDate, LocalDate endDate) {
        LocalDate resolvedStartDate = startDate != null ? startDate : LocalDate.now().withDayOfMonth(1);
        LocalDate resolvedEndDate = endDate != null ? endDate : LocalDate.now();

        List<Map<String, Object>> candidates = jdbcTemplate.queryForList("""
                SELECT
                    o.company_id,
                    (COALESCE(o.pay_time, o.ord_time, o.wdate)::date + INTERVAL '2 day')::date AS settlement_date,
                    s.shop_name,
                    s.platform,
                    COALESCE(SUM(COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0)), 0) AS settlement_amount,
                    COUNT(*) AS order_count
                FROM orders o
                JOIN shop s ON s.id = o.shop_id
                WHERE o.company_id = ?
                  AND COALESCE(o.pay_time, o.ord_time, o.wdate)::date BETWEEN ? AND ?
                  AND s.platform <> 'OTHER'
                GROUP BY o.company_id, settlement_date, s.shop_name, s.platform
                HAVING COALESCE(SUM(COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0)), 0) > 0
                ORDER BY settlement_date, s.shop_name
                """, companyId, resolvedStartDate, resolvedEndDate);

        int inserted = 0;
        int skipped = 0;

        for (Map<String, Object> row : candidates) {
            String sourceKey = "ONLINE_SETTLEMENT:"
                    + row.get("company_id") + ":"
                    + row.get("settlement_date") + ":"
                    + row.get("platform") + ":"
                    + row.get("shop_name");

            int updated = jdbcTemplate.update("""
                    INSERT INTO executive_cash_flow (
                        company_id, flow_date, flow_type, category, counterparty, amount,
                        status, confidence_level, recurring_rule, source_type, source_key, memo
                    )
                    VALUES (?, ?, 'INFLOW', '온라인 채널 정산', ?, ?, 'EXPECTED', 'EXPECTED', 'NONE',
                            'ONLINE_SETTLEMENT', ?, ?)
                    ON CONFLICT (source_key) DO NOTHING
                    """,
                    companyId,
                    row.get("settlement_date"),
                    row.get("shop_name"),
                    row.get("settlement_amount"),
                    sourceKey,
                    "온라인 주문 " + row.get("order_count") + "건 기준 자동 생성"
            );

            if (updated > 0) {
                inserted++;
            } else {
                skipped++;
            }
        }

        return Map.of(
                "startDate", resolvedStartDate,
                "endDate", resolvedEndDate,
                "candidateCount", candidates.size(),
                "insertedCount", inserted,
                "skippedCount", skipped
        );
    }

    private List<Map<String, Object>> getDailyCashProjection(Long companyId) {
        return jdbcTemplate.queryForList("""
                WITH base AS (
                    SELECT COALESCE(SUM(balance), 0) AS opening_cash
                    FROM executive_cash_account
                    WHERE company_id = ?
                ),
                calendar AS (
                    SELECT generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 day', INTERVAL '1 day')::date AS target_date
                ),
                daily AS (
                    SELECT flow_date,
                           COALESCE(SUM(amount) FILTER (WHERE flow_type = 'INFLOW'), 0) AS inflow,
                           COALESCE(SUM(amount) FILTER (WHERE flow_type = 'OUTFLOW'), 0) AS outflow,
                           COALESCE(SUM(amount) FILTER (WHERE flow_type = 'INFLOW' AND confidence_level = 'CONFIRMED'), 0) AS confirmed_inflow,
                           COALESCE(SUM(amount) FILTER (WHERE flow_type = 'OUTFLOW' AND confidence_level = 'CONFIRMED'), 0) AS confirmed_outflow
                    FROM executive_cash_flow
                    WHERE company_id = ?
                    GROUP BY flow_date
                ),
                projection AS (
                    SELECT
                        c.target_date,
                        COALESCE(d.inflow, 0) AS inflow,
                        COALESCE(d.outflow, 0) AS outflow,
                        COALESCE(d.confirmed_inflow, 0) AS confirmed_inflow,
                        COALESCE(d.confirmed_outflow, 0) AS confirmed_outflow,
                        (SELECT opening_cash FROM base)
                            + SUM(COALESCE(d.inflow, 0) - COALESCE(d.outflow, 0)) OVER (ORDER BY c.target_date) AS projected_balance
                    FROM calendar c
                    LEFT JOIN daily d ON d.flow_date = c.target_date
                )
                SELECT *
                FROM projection
                ORDER BY target_date
                """, companyId, companyId);
    }

    public List<Map<String, Object>> getProductProfits(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT
                    product.*,
                    CASE
                        WHEN product.stock_quantity <= COALESCE(NULLIF(product.safe_stock, 0), 3000) THEN 'LOW_STOCK'
                        WHEN product.margin_rate < 10 THEN 'LOW_MARGIN'
                        WHEN product.stock_quantity >= COALESCE(NULLIF(product.safe_stock, 0), 3000) * 3 THEN 'OVER_STOCK'
                        ELSE 'NORMAL'
                    END AS status,
                    CASE
                        WHEN product.stock_quantity <= COALESCE(NULLIF(product.safe_stock, 0), 3000) THEN true
                        ELSE false
                    END AS reorder_required
                FROM executive_product_profit product
                WHERE product.company_id = ?
                ORDER BY expected_net_profit DESC
                """, companyId);
    }

    public List<Map<String, Object>> getProductForecasts(Long companyId) {
        ResourceDefinition definition = RESOURCE_DEFINITIONS.get("product-forecasts");
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_product_forecast
                WHERE company_id = ?
                ORDER BY launch_month NULLS LAST, expected_operating_profit DESC
                """, companyId).stream()
                .map(row -> {
                    Map<String, Object> forecast = new LinkedHashMap<>(row);
                    applyProductForecastCalculations(definition, forecast, forecast);
                    forecast.put("forecast_status", forecastStatus(decimalValue(forecast.get("expected_operating_margin_rate"))));
                    return forecast;
                })
                .toList();
    }

    public List<Map<String, Object>> getChannelSales(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_channel_performance
                WHERE company_id = ?
                ORDER BY report_month DESC, sales_amount DESC
                """, companyId);
    }

    public List<Map<String, Object>> getConsultingRevenues(Long companyId) {
        ResourceDefinition definition = RESOURCE_DEFINITIONS.get("consulting-revenues");
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_consulting_revenue
                WHERE company_id = ?
                ORDER BY expected_payment_date NULLS LAST, contract_amount DESC
                """, companyId).stream()
                .map(row -> {
                    Map<String, Object> consultingRevenue = new LinkedHashMap<>(row);
                    applyConsultingRevenueCalculations(definition, consultingRevenue, consultingRevenue);
                    return consultingRevenue;
                })
                .toList();
    }

    public Map<String, Object> getChannelSalesAnalytics(Long companyId, LocalDate startDate, LocalDate endDate) {
        LocalDate resolvedEndDate = endDate != null ? endDate : LocalDate.now();
        LocalDate resolvedStartDate = startDate != null ? startDate : resolvedEndDate.withDayOfMonth(1);

        List<Map<String, Object>> channels = jdbcTemplate.queryForList("""
                WITH playauto AS (
                    SELECT
                        s.shop_name AS channel_name,
                        'PLAYAUTO' AS source_type,
                        ROUND(COALESCE(SUM(d.net_revenue), 0), 0) AS sales_amount,
                        COALESCE(SUM(d.orderer_count), 0)::int AS order_count,
                        ROUND(COALESCE(SUM(d.net_revenue), 0) * 0.10, 0) AS ad_cost,
                        ROUND(COALESCE(SUM(d.net_revenue), 0)
                            - COALESCE(SUM(COALESCE(NULLIF(p.product_price, 0), matched_profit.selling_price, 0) * 0.40 * d.orderer_count), 0)
                            - (COALESCE(SUM(d.net_revenue), 0) * 0.10), 0) AS estimated_operating_profit
                    FROM daily_sales_stats d
                    JOIN shop s ON s.id = d.shop_id
                    LEFT JOIN product p ON p.id = d.product_id
                    LEFT JOIN LATERAL (
                        SELECT e.selling_price
                        FROM executive_product_profit e
                        WHERE e.company_id = d.company_id
                          AND (
                              e.sku = p.sku_cd
                              OR p.product_name ILIKE CONCAT('%', e.product_name, '%')
                              OR e.product_name ILIKE CONCAT('%', p.product_name, '%')
                          )
                        ORDER BY LENGTH(e.product_name) DESC
                        LIMIT 1
                    ) matched_profit ON true
                    WHERE d.company_id = ?
                      AND d.date BETWEEN ? AND ?
                      AND s.platform <> 'OTHER'
                    GROUP BY s.shop_name
                ),
                manual AS (
                    SELECT
                        channel_name,
                        COALESCE(source_type, 'MANUAL') AS source_type,
                        ROUND(COALESCE(SUM(sales_amount), 0), 0) AS sales_amount,
                        COALESCE(SUM(order_count), 0)::int AS order_count,
                        ROUND(COALESCE(SUM(ad_cost), 0), 0) AS ad_cost,
                        ROUND(COALESCE(SUM(net_profit), 0), 0) AS estimated_operating_profit
                    FROM executive_channel_performance
                    WHERE company_id = ?
                      AND COALESCE(source_type, 'MANUAL') <> 'PLAYAUTO'
                      AND report_month BETWEEN date_trunc('month', CAST(? AS date))::date AND date_trunc('month', CAST(? AS date))::date
                    GROUP BY channel_name, COALESCE(source_type, 'MANUAL')
                ),
                combined AS (
                    SELECT * FROM playauto
                    UNION ALL
                    SELECT * FROM manual
                )
                SELECT
                    channel_name,
                    source_type,
                    sales_amount,
                    order_count,
                    CASE WHEN order_count = 0 THEN 0 ELSE ROUND(sales_amount / order_count, 0) END AS average_order_value,
                    ad_cost,
                    estimated_operating_profit,
                    CASE WHEN sales_amount = 0 THEN 0 ELSE ROUND(estimated_operating_profit / sales_amount * 100, 1) END AS estimated_operating_margin
                FROM combined
                WHERE sales_amount <> 0 OR order_count <> 0
                ORDER BY sales_amount DESC
                """, companyId, resolvedStartDate, resolvedEndDate, companyId, resolvedStartDate, resolvedEndDate);

        List<Map<String, Object>> products = jdbcTemplate.queryForList("""
                SELECT
                    s.shop_name AS channel_name,
                    p.product_name,
                    p.sku_cd AS sku,
                    b.brand_name,
                    ROUND(COALESCE(SUM(d.net_revenue), 0), 0) AS sales_amount,
                    COALESCE(SUM(d.orderer_count), 0)::int AS order_count,
                    ROUND(COALESCE(AVG(COALESCE(NULLIF(p.product_price, 0), matched_profit.selling_price, 0) * 0.40), 0), 0) AS unit_cost,
                    ROUND(COALESCE(SUM(COALESCE(NULLIF(p.product_price, 0), matched_profit.selling_price, 0) * 0.40 * d.orderer_count), 0), 0) AS estimated_cost,
                    ROUND(COALESCE(SUM(d.net_revenue), 0) * 0.10, 0) AS ad_cost,
                    ROUND(COALESCE(SUM(d.net_revenue), 0)
                        - COALESCE(SUM(COALESCE(NULLIF(p.product_price, 0), matched_profit.selling_price, 0) * 0.40 * d.orderer_count), 0)
                        - (COALESCE(SUM(d.net_revenue), 0) * 0.10), 0) AS estimated_operating_profit,
                    CASE
                        WHEN COALESCE(SUM(d.net_revenue), 0) = 0 THEN 0
                        ELSE ROUND((COALESCE(SUM(d.net_revenue), 0)
                            - COALESCE(SUM(COALESCE(NULLIF(p.product_price, 0), matched_profit.selling_price, 0) * 0.40 * d.orderer_count), 0)
                            - (COALESCE(SUM(d.net_revenue), 0) * 0.10))
                            / COALESCE(SUM(d.net_revenue), 0) * 100, 1)
                    END AS estimated_operating_margin
                FROM daily_sales_stats d
                JOIN shop s ON s.id = d.shop_id
                JOIN product p ON p.id = d.product_id
                JOIN brand b ON b.id = d.brand_id
                LEFT JOIN LATERAL (
                    SELECT e.selling_price
                    FROM executive_product_profit e
                    WHERE e.company_id = d.company_id
                      AND (
                          e.sku = p.sku_cd
                          OR p.product_name ILIKE CONCAT('%', e.product_name, '%')
                          OR e.product_name ILIKE CONCAT('%', p.product_name, '%')
                      )
                    ORDER BY LENGTH(e.product_name) DESC
                    LIMIT 1
                ) matched_profit ON true
                WHERE d.company_id = ?
                  AND d.date BETWEEN ? AND ?
                  AND s.platform <> 'OTHER'
                GROUP BY s.shop_name, p.product_name, p.sku_cd, b.brand_name
                HAVING COALESCE(SUM(d.net_revenue), 0) <> 0 OR COALESCE(SUM(d.orderer_count), 0) <> 0
                ORDER BY sales_amount DESC, order_count DESC
                """, companyId, resolvedStartDate, resolvedEndDate);

        BigDecimal totalSales = channels.stream()
                .map(row -> decimalValue(row.get("sales_amount")))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalProfit = channels.stream()
                .map(row -> decimalValue(row.get("estimated_operating_profit")))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int totalOrders = channels.stream()
                .mapToInt(row -> ((Number) row.getOrDefault("order_count", 0)).intValue())
                .sum();
        BigDecimal totalAdCost = channels.stream()
                .map(row -> decimalValue(row.get("ad_cost")))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("salesAmount", totalSales);
        summary.put("orderCount", totalOrders);
        summary.put("averageOrderValue", totalOrders > 0
                ? totalSales.divide(BigDecimal.valueOf(totalOrders), 0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO);
        summary.put("adCost", totalAdCost);
        summary.put("estimatedOperatingProfit", totalProfit);
        summary.put("estimatedOperatingMargin", percentValue(totalProfit, totalSales));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("startDate", resolvedStartDate);
        result.put("endDate", resolvedEndDate);
        result.put("summary", summary);
        result.put("channels", channels);
        result.put("products", products);
        return result;
    }

    public Map<String, Object> importPlayAutoChannelSales(Long companyId) {
        return importPlayAutoChannelSales(companyId, null, null, false);
    }

    public Map<String, Object> importPlayAutoChannelSales(
            Long companyId,
            LocalDate startDate,
            LocalDate endDate,
            boolean refreshOrders
    ) {
        LocalDate resolvedEndDate = endDate != null ? endDate : LocalDate.now();
        LocalDate resolvedStartDate = startDate != null ? startDate : resolvedEndDate;

        if (refreshOrders) {
            playAutoSyncService.syncProducts(companyId);
            playAutoSyncService.syncOrders(
                    companyId,
                    resolvedStartDate.toString(),
                    resolvedEndDate.toString()
            );
            playAutoSyncService.remapOrdersToResolvedProducts(companyId);
            playAutoSyncService.rebuildDailySalesStats(companyId);
        }

        Integer candidateCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM (
                    SELECT date_trunc('month', d.date)::date AS report_month, d.shop_id
                    FROM daily_sales_stats d
                    JOIN shop s ON s.id = d.shop_id
                    WHERE d.company_id = ?
                      AND s.platform <> 'OTHER'
                    GROUP BY date_trunc('month', d.date)::date, d.shop_id
                    HAVING COALESCE(SUM(d.net_revenue), 0) <> 0
                ) candidate
                """, Integer.class, companyId);

        int upserted = jdbcTemplate.update("""
                INSERT INTO executive_channel_performance (
                    company_id, channel_name, sales_amount, ad_cost, roas, margin_rate,
                    order_count, average_order_value, net_profit, report_month,
                    source_type, source_key
                )
                SELECT
                    d.company_id,
                    s.shop_name AS channel_name,
                    ROUND(COALESCE(SUM(d.net_revenue), 0), 0) AS sales_amount,
                    0 AS ad_cost,
                    0 AS roas,
                    0 AS margin_rate,
                    COALESCE(SUM(d.orderer_count), 0)::int AS order_count,
                    CASE
                        WHEN COALESCE(SUM(d.orderer_count), 0) = 0 THEN 0
                        ELSE ROUND(COALESCE(SUM(d.net_revenue), 0) / COALESCE(SUM(d.orderer_count), 0), 0)
                    END AS average_order_value,
                    0 AS net_profit,
                    date_trunc('month', d.date)::date AS report_month,
                    'PLAYAUTO' AS source_type,
                    CONCAT('PLAYAUTO_CHANNEL:', d.company_id, ':', date_trunc('month', d.date)::date, ':', d.shop_id) AS source_key
                FROM daily_sales_stats d
                JOIN shop s ON s.id = d.shop_id
                WHERE d.company_id = ?
                  AND s.platform <> 'OTHER'
                GROUP BY d.company_id, date_trunc('month', d.date)::date, d.shop_id, s.shop_name
                HAVING COALESCE(SUM(d.net_revenue), 0) <> 0
                ON CONFLICT (source_key) WHERE source_key IS NOT NULL
                DO UPDATE SET
                    channel_name = EXCLUDED.channel_name,
                    sales_amount = EXCLUDED.sales_amount,
                    ad_cost = EXCLUDED.ad_cost,
                    roas = EXCLUDED.roas,
                    margin_rate = EXCLUDED.margin_rate,
                    order_count = EXCLUDED.order_count,
                    average_order_value = EXCLUDED.average_order_value,
                    net_profit = EXCLUDED.net_profit,
                    report_month = EXCLUDED.report_month,
                    source_type = EXCLUDED.source_type
                """, companyId);

        return Map.of(
                "startDate", resolvedStartDate,
                "endDate", resolvedEndDate,
                "refreshedOrders", refreshOrders,
                "candidateCount", candidateCount != null ? candidateCount : 0,
                "upsertedCount", upserted
        );
    }

    public List<Map<String, Object>> getReceivables(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *,
                    invoice_amount - paid_amount AS remaining_amount,
                    GREATEST(CURRENT_DATE - due_date, 0) AS overdue_days,
                    CASE
                        WHEN invoice_amount = 0 THEN 100
                        ELSE ROUND((paid_amount / invoice_amount) * 100, 1)
                    END AS recovery_rate
                FROM executive_receivable
                WHERE company_id = ?
                ORDER BY
                    CASE risk_level
                        WHEN 'CRITICAL' THEN 1
                        WHEN 'HIGH' THEN 2
                        WHEN 'WATCH' THEN 3
                        ELSE 4
                    END,
                    due_date
                """, companyId);
    }

    public List<Map<String, Object>> getOperatingExpenses(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_operating_expense
                WHERE company_id = ?
                ORDER BY amount DESC
                """, companyId);
    }

    public List<Map<String, Object>> getDebts(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_debt
                WHERE company_id = ?
                ORDER BY next_payment_date
                """, companyId);
    }

    public List<Map<String, Object>> getExportPipeline(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_export_pipeline
                WHERE company_id = ?
                ORDER BY expected_sales DESC
                """, companyId);
    }

    public List<Map<String, Object>> getExportSupplyPrices(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_export_supply_price
                WHERE company_id = ?
                ORDER BY
                    CASE country
                        WHEN '몽골' THEN 1
                        WHEN '대만' THEN 2
                        WHEN '홍콩' THEN 3
                        WHEN '베트남' THEN 4
                        ELSE 5
                    END,
                    moq,
                    product_name
                """, companyId);
    }

    public List<Map<String, Object>> getAdPerformance(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_ad_performance
                WHERE company_id = ?
                ORDER BY roas DESC
                """, companyId);
    }

    public List<Map<String, Object>> getIssueLogs(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_issue_log
                WHERE company_id = ?
                ORDER BY
                    CASE severity
                        WHEN 'CRITICAL' THEN 1
                        WHEN 'HIGH' THEN 2
                        WHEN 'MEDIUM' THEN 3
                        ELSE 4
                    END,
                    issue_date DESC
                """, companyId);
    }

    public Map<String, Object> createRecord(String resource, Map<String, Object> payload) {
        ResourceDefinition definition = getResourceDefinition(resource);
        Map<String, Object> values = sanitizePayload(definition, payload);
        values.putIfAbsent("company_id", 1);
        applyProductProfitCalculations(definition, values, values);
        applyProductForecastCalculations(definition, values, values);
        applyConsultingRevenueCalculations(definition, values, values);

        if (values.isEmpty()) {
            throw new IllegalArgumentException("저장할 데이터가 없습니다.");
        }

        List<String> columns = new ArrayList<>(values.keySet());
        String columnSql = String.join(", ", columns);
        String placeholderSql = columns.stream().map(column -> "?").reduce((a, b) -> a + ", " + b).orElse("");
        Object[] params = columns.stream().map(values::get).toArray();

        jdbcTemplate.update(
                "INSERT INTO " + definition.tableName() + " (" + columnSql + ") VALUES (" + placeholderSql + ")",
                params
        );

        Long id = jdbcTemplate.queryForObject(
                "SELECT id FROM " + definition.tableName() + " WHERE company_id = ? ORDER BY id DESC LIMIT 1",
                Long.class,
                values.get("company_id")
        );

        return getRecord(definition, id);
    }

    public Map<String, Object> updateRecord(String resource, Long id, Map<String, Object> payload) {
        ResourceDefinition definition = getResourceDefinition(resource);
        Map<String, Object> values = sanitizePayload(definition, payload);
        values.remove("company_id");
        if ("executive_product_profit".equals(definition.tableName())
                || "executive_product_forecast".equals(definition.tableName())
                || "executive_consulting_revenue".equals(definition.tableName())) {
            Map<String, Object> baseValues = new HashMap<>(getRecord(definition, id));
            baseValues.putAll(values);
            applyProductProfitCalculations(definition, baseValues, values);
            applyProductForecastCalculations(definition, baseValues, values);
            applyConsultingRevenueCalculations(definition, baseValues, values);
        }

        if (values.isEmpty()) {
            throw new IllegalArgumentException("수정할 데이터가 없습니다.");
        }

        List<String> columns = new ArrayList<>(values.keySet());
        String setSql = columns.stream().map(column -> column + " = ?").reduce((a, b) -> a + ", " + b).orElse("");
        List<Object> params = new ArrayList<>(columns.stream().map(values::get).toList());
        params.add(id);

        int updated = jdbcTemplate.update(
                "UPDATE " + definition.tableName() + " SET " + setSql + " WHERE id = ?",
                params.toArray()
        );

        if (updated == 0) {
            throw new IllegalArgumentException("수정할 데이터를 찾을 수 없습니다.");
        }

        return getRecord(definition, id);
    }

    public void deleteRecord(String resource, Long id) {
        ResourceDefinition definition = getResourceDefinition(resource);
        jdbcTemplate.update("DELETE FROM " + definition.tableName() + " WHERE id = ?", id);
    }

    public List<Map<String, Object>> queryAccounts(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_cash_account
                WHERE company_id = ?
                ORDER BY balance DESC
                """, companyId);
    }

    private void applyProductProfitCalculations(
            ResourceDefinition definition,
            Map<String, Object> sourceValues,
            Map<String, Object> targetValues
    ) {
        if (!"executive_product_profit".equals(definition.tableName())) {
            return;
        }

        BigDecimal grossSales = decimalValue(sourceValues.get("gross_sales"));
        BigDecimal exportCost = decimalValue(sourceValues.get("export_cost_ex_vat"));
        BigDecimal productionCost = exportCost.compareTo(BigDecimal.ZERO) > 0
                ? exportCost.multiply(BigDecimal.valueOf(5000))
                : decimalValue(sourceValues.get("production_cost"));
        BigDecimal totalAdminCost = decimalValue(sourceValues.get("marketing_cost"))
                .add(decimalValue(sourceValues.get("ad_cost")))
                .add(decimalValue(sourceValues.get("operating_admin_cost")))
                .add(decimalValue(sourceValues.get("platform_fee")))
                .add(decimalValue(sourceValues.get("storage_cost")))
                .add(decimalValue(sourceValues.get("logistics_cost")));
        BigDecimal grossProfit = grossSales.subtract(productionCost);
        BigDecimal operatingProfit = grossProfit.subtract(totalAdminCost);

        targetValues.put("total_admin_cost", moneyValue(totalAdminCost));
        targetValues.put("gross_profit", moneyValue(grossProfit));
        targetValues.put("gross_profit_rate", percentValue(grossProfit, grossSales));
        targetValues.put("expected_net_profit", moneyValue(operatingProfit));
        targetValues.put("margin_rate", percentValue(operatingProfit, grossSales));
    }

    private void applyProductForecastCalculations(
            ResourceDefinition definition,
            Map<String, Object> sourceValues,
            Map<String, Object> targetValues
    ) {
        if (!"executive_product_forecast".equals(definition.tableName())) {
            return;
        }

        BigDecimal expectedMonthlyUnits = decimalValue(sourceValues.get("expected_monthly_units"));
        BigDecimal expectedSellingPrice = decimalValue(sourceValues.get("expected_selling_price"));
        BigDecimal unitProductionCost = decimalValue(sourceValues.get("unit_production_cost"));
        BigDecimal logisticsCostPerUnit = decimalValue(sourceValues.get("logistics_cost_per_unit"));

        BigDecimal totalUnits = BigDecimal.ZERO;
        for (int index = 0; index < PRODUCT_FORECAST_MONTHS; index++) {
            BigDecimal monthUnits = expectedMonthlyUnits
                    .multiply(PRODUCT_FORECAST_GROWTH_FACTORS.get(index))
                    .setScale(0, RoundingMode.HALF_UP);
            totalUnits = totalUnits.add(monthUnits);
        }

        BigDecimal expectedSales = totalUnits.multiply(expectedSellingPrice);
        BigDecimal productionCost = totalUnits.multiply(unitProductionCost);
        BigDecimal logisticsCost = totalUnits.multiply(logisticsCostPerUnit);
        BigDecimal expectedGrossProfit = expectedSales.subtract(productionCost);

        BigDecimal platformFee = expectedSales
                .multiply(decimalValue(sourceValues.get("platform_fee_rate")))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal adCost = expectedSales
                .multiply(decimalValue(sourceValues.get("ad_cost_rate")))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal operatingAdminCost = expectedSales
                .multiply(decimalValue(sourceValues.get("operating_admin_rate")))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        BigDecimal expectedOperatingProfit = expectedGrossProfit
                .subtract(platformFee)
                .subtract(adCost)
                .subtract(operatingAdminCost)
                .subtract(logisticsCost);

        targetValues.put("forecast_months", PRODUCT_FORECAST_MONTHS);
        targetValues.put("expected_sales", moneyValue(expectedSales));
        targetValues.put("expected_gross_profit", moneyValue(expectedGrossProfit));
        targetValues.put("expected_gross_margin_rate", percentValue(expectedGrossProfit, expectedSales));
        targetValues.put("expected_operating_profit", moneyValue(expectedOperatingProfit));
        targetValues.put("expected_operating_margin_rate", percentValue(expectedOperatingProfit, expectedSales));
    }

    private String forecastStatus(BigDecimal operatingMarginRate) {
        if (operatingMarginRate.compareTo(BigDecimal.ZERO) < 0) {
            return "LOSS";
        }
        if (operatingMarginRate.compareTo(BigDecimal.TEN) < 0) {
            return "LOW_MARGIN";
        }
        if (operatingMarginRate.compareTo(BigDecimal.valueOf(20)) < 0) {
            return "WATCH";
        }
        return "HEALTHY";
    }

    private void applyConsultingRevenueCalculations(
            ResourceDefinition definition,
            Map<String, Object> sourceValues,
            Map<String, Object> targetValues
    ) {
        if (!"executive_consulting_revenue".equals(definition.tableName())) {
            return;
        }

        BigDecimal contractAmount = decimalValue(sourceValues.get("contract_amount"));
        BigDecimal totalCost = decimalValue(sourceValues.get("labor_cost"))
                .add(decimalValue(sourceValues.get("outsourcing_cost")))
                .add(decimalValue(sourceValues.get("other_cost")));
        BigDecimal grossProfit = contractAmount.subtract(totalCost);

        targetValues.put("total_cost", moneyValue(totalCost));
        targetValues.put("gross_profit", moneyValue(grossProfit));
        targetValues.put("operating_profit", moneyValue(grossProfit));
        targetValues.put("operating_margin_rate", percentValue(grossProfit, contractAmount));
    }

    private BigDecimal decimalValue(Object value) {
        if (value == null || "".equals(value)) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        return new BigDecimal(String.valueOf(value).replace(",", "").trim());
    }

    private BigDecimal moneyValue(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal percentValue(BigDecimal numerator, BigDecimal denominator) {
        if (denominator.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return numerator
                .multiply(BigDecimal.valueOf(100))
                .divide(denominator, 2, RoundingMode.HALF_UP);
    }

    private ResourceDefinition getResourceDefinition(String resource) {
        ResourceDefinition definition = RESOURCE_DEFINITIONS.get(resource);
        if (definition == null) {
            throw new IllegalArgumentException("지원하지 않는 데이터 영역입니다: " + resource);
        }
        return definition;
    }

    private Map<String, Object> sanitizePayload(ResourceDefinition definition, Map<String, Object> payload) {
        Map<String, Object> values = new HashMap<>();
        payload.forEach((key, value) -> {
            if (definition.columns().contains(key) && value != null && !"".equals(value)) {
                values.put(key, normalizeValue(key, value));
            }
        });
        return values;
    }

    private Object normalizeValue(String column, Object value) {
        if (DATE_COLUMNS.contains(column) && value instanceof String rawValue) {
            return LocalDate.parse(rawValue);
        }
        if (DECIMAL_COLUMNS.contains(column) && value instanceof String rawValue) {
            return new BigDecimal(rawValue.replace(",", "").trim());
        }
        if (INTEGER_COLUMNS.contains(column) && value instanceof String rawValue) {
            return Integer.parseInt(rawValue.replace(",", "").trim());
        }
        return value;
    }

    private Map<String, Object> getRecord(ResourceDefinition definition, Long id) {
        return jdbcTemplate.queryForMap(
                "SELECT * FROM " + definition.tableName() + " WHERE id = ?",
                id
        );
    }

    private String getCashRiskStatus(Long companyId) {
        Map<String, Object> cash = jdbcTemplate.queryForMap("""
                WITH base AS (
                    SELECT COALESCE(SUM(balance), 0) AS opening_cash
                    FROM executive_cash_account
                    WHERE company_id = ?
                ),
                dated_flow AS (
                    SELECT flow_date, SUM(CASE WHEN flow_type = 'INFLOW' THEN amount ELSE -amount END) AS net_flow
                    FROM executive_cash_flow
                    WHERE company_id = ?
                    GROUP BY flow_date
                    UNION ALL
                    SELECT expected_payment_date AS flow_date, SUM(GREATEST(contract_amount - paid_amount, 0)) AS net_flow
                    FROM executive_consulting_revenue
                    WHERE company_id = ?
                      AND status <> 'CANCELLED'
                      AND expected_payment_date IS NOT NULL
                    GROUP BY expected_payment_date
                    UNION ALL
                    SELECT COALESCE(payment_date, expense_month) AS flow_date, -SUM(amount) AS net_flow
                    FROM executive_operating_expense
                    WHERE company_id = ?
                    GROUP BY COALESCE(payment_date, expense_month)
                    UNION ALL
                    SELECT next_payment_date AS flow_date, -SUM(monthly_payment) AS net_flow
                    FROM executive_debt
                    WHERE company_id = ?
                      AND next_payment_date IS NOT NULL
                      AND status <> 'CLOSED'
                    GROUP BY next_payment_date
                )
                SELECT (SELECT opening_cash FROM base) + COALESCE(SUM(net_flow), 0) AS projected_cash
                FROM dated_flow
                WHERE flow_date <= CURRENT_DATE + INTERVAL '14 day'
                """, companyId, companyId, companyId, companyId, companyId);

        double projectedCash = Number.class.cast(cash.get("projected_cash")).doubleValue();
        if (projectedCash < 0) {
            return "위험";
        }
        if (projectedCash < 30_000_000) {
            return "주의";
        }
        return "정상";
    }

    private Object getExpectedCashShortageDate(Long companyId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                WITH base AS (
                    SELECT COALESCE(SUM(balance), 0) AS opening_cash
                    FROM executive_cash_account
                    WHERE company_id = ?
                ),
                calendar AS (
                    SELECT generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '180 day', INTERVAL '1 day')::date AS flow_date
                ),
                dated_flow AS (
                    SELECT flow_date, SUM(CASE WHEN flow_type = 'INFLOW' THEN amount ELSE -amount END) AS net_flow
                    FROM executive_cash_flow
                    WHERE company_id = ?
                    GROUP BY flow_date
                    UNION ALL
                    SELECT expected_payment_date AS flow_date, SUM(GREATEST(contract_amount - paid_amount, 0)) AS net_flow
                    FROM executive_consulting_revenue
                    WHERE company_id = ?
                      AND status <> 'CANCELLED'
                      AND expected_payment_date IS NOT NULL
                    GROUP BY expected_payment_date
                    UNION ALL
                    SELECT COALESCE(payment_date, expense_month) AS flow_date, -SUM(amount) AS net_flow
                    FROM executive_operating_expense
                    WHERE company_id = ?
                    GROUP BY COALESCE(payment_date, expense_month)
                    UNION ALL
                    SELECT next_payment_date AS flow_date, -SUM(monthly_payment) AS net_flow
                    FROM executive_debt
                    WHERE company_id = ?
                      AND next_payment_date IS NOT NULL
                      AND status <> 'CLOSED'
                    GROUP BY next_payment_date
                ),
                daily AS (
                    SELECT c.flow_date, COALESCE(SUM(d.net_flow), 0) AS net_flow
                    FROM calendar c
                    LEFT JOIN dated_flow d ON d.flow_date = c.flow_date
                    GROUP BY c.flow_date
                ),
                projected AS (
                    SELECT d.flow_date,
                           (SELECT opening_cash FROM base)
                           + SUM(d.net_flow) OVER (ORDER BY d.flow_date) AS projected_cash
                    FROM daily d
                )
                SELECT flow_date
                FROM projected
                WHERE projected_cash < 0
                ORDER BY flow_date
                LIMIT 1
                """, companyId, companyId, companyId, companyId, companyId);

        return rows.isEmpty() ? null : rows.get(0).get("flow_date");
    }

    private int countUrgentIssues(Long companyId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM executive_issue_log
                WHERE company_id = ? AND severity IN ('HIGH', 'CRITICAL') AND status <> 'RESOLVED'
                """, Integer.class, companyId);
        return count == null ? 0 : count;
    }
}
