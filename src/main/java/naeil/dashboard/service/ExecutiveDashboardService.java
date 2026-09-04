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
import naeil.dashboard.common.config.EncryptionUtil;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
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
                    "expected_operating_margin_rate", "launch_checklist", "memo"
            ))),
            Map.entry("work-tasks", new ResourceDefinition("executive_work_task", Set.of(
                    "company_id", "project_name", "task_name", "assignee_name", "department",
                    "work_category", "linked_product_name", "priority", "status", "progress_rate",
                    "start_date", "due_date", "completed_date", "approval_required", "today_work",
                    "blocker_text", "next_action", "request_text", "review_comment", "source_type",
                    "source_key"
            ))),
            Map.entry("payment-requests", new ResourceDefinition("executive_payment_request", Set.of(
                    "company_id", "request_type", "flow_type", "project_name", "linked_product_name",
                    "counterparty", "requester_name", "department", "amount", "request_date",
                    "scheduled_date", "account_name", "purpose", "detail_reason", "evidence_url",
                    "expense_category", "urgent", "status", "review_comment", "cash_flow_id"
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
                    "due_date", "status", "risk_level", "memo", "partner_type", "business_scope", "owner_name",
                    "tax_email", "bank_account", "settlement_terms", "country", "contract_status", "last_contact_date",
                    "partner_id"
            ))),
            Map.entry("partners", new ResourceDefinition("executive_partner", Set.of(
                    "company_id", "partner_name", "partner_type", "business_scope", "manager_name",
                    "owner_name", "contact", "tax_email", "bank_account", "settlement_terms",
                    "country", "contract_status", "last_contact_date", "memo"
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
                    "company_id", "product_name", "ad_channel", "ad_cost", "click_count", "cpa", "roas", "conversion_rate",
                    "sales_amount", "net_profit", "report_month"
            ))),
            Map.entry("ad-roas-goals", new ResourceDefinition("executive_ad_roas_goal", Set.of(
                    "company_id", "period_type", "product_name", "ad_type", "target_roas", "start_date",
                    "end_date", "owner_name", "memo", "status"
            ))),
            Map.entry("issues", new ResourceDefinition("executive_issue_log", Set.of(
                    "company_id", "issue_date", "severity", "category", "title", "description", "status"
            ))),
            Map.entry("customer-inquiries", new ResourceDefinition("executive_customer_inquiry", Set.of(
                    "company_id", "channel", "external_id", "customer_name", "inquiry_type", "message",
                    "status", "assigned_to", "received_at", "answered_at", "urgent", "ai_category",
                    "ai_summary", "source_url", "raw_payload"
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
            "completed_date",
            "request_date",
            "scheduled_date",
            "expense_month",
            "payment_date",
            "next_payment_date",
            "maturity_date",
            "expected_payment_date",
            "issue_date",
            "last_contact_date"
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
            "expected_monthly_units",
            "progress_rate",
            "partner_id"
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
                      AND category ILIKE '%??⑹탪??'
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
        result.put("customerInquiryCount", countOpenCustomerInquiries(companyId));
        result.put("unansweredCustomerInquiryCount", countUnansweredCustomerInquiries(companyId));
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
                  AND s.shop_code <> 'A000'
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

    public Map<String, Object> getProductMovements(Long companyId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                WITH latest_outbound AS (
                    SELECT DISTINCT ON (product_id)
                        product_id,
                        outbound_accum_snapshot,
                        collected_at
                    FROM product_outbound
                    WHERE company_id = ?
                    ORDER BY product_id, outbound_date DESC, collected_at DESC
                ),
                today_outbound AS (
                    SELECT product_id, COALESCE(SUM(outbound_count), 0) AS outbound_count
                    FROM product_outbound
                    WHERE company_id = ? AND outbound_date = CURRENT_DATE
                    GROUP BY product_id
                ),
                recent_outbound AS (
                    SELECT product_id, COALESCE(SUM(outbound_count), 0) AS outbound_count
                    FROM product_outbound
                    WHERE company_id = ? AND outbound_date >= CURRENT_DATE - INTERVAL '6 day'
                    GROUP BY product_id
                )
                SELECT
                    p.id,
                    p.product_name,
                    p.sku_cd,
                    p.prod_no,
                    p.real_stock,
                    p.safe_stock,
                    b.brand_name,
                    COALESCE(t.outbound_count, 0)::int AS today_outbound_count,
                    COALESCE(r.outbound_count, 0)::int AS last_7_days_outbound_count,
                    COALESCE(l.outbound_accum_snapshot, 0)::int AS outbound_accum_snapshot,
                    l.collected_at,
                    CASE
                        WHEN p.real_stock <= 0 THEN 'OUT_OF_STOCK'
                        WHEN p.real_stock <= GREATEST(COALESCE(NULLIF(p.safe_stock, 0), 1), 1) THEN 'LOW_STOCK'
                        WHEN COALESCE(r.outbound_count, 0) = 0 THEN 'NO_RECENT_OUTBOUND'
                        ELSE 'NORMAL'
                    END AS stock_status
                FROM product p
                LEFT JOIN brand b ON b.id = p.brand_id
                LEFT JOIN latest_outbound l ON l.product_id = p.id
                LEFT JOIN today_outbound t ON t.product_id = p.id
                LEFT JOIN recent_outbound r ON r.product_id = p.id
                WHERE p.company_id = ?
                ORDER BY
                    CASE
                        WHEN p.real_stock <= 0 THEN 1
                        WHEN p.real_stock <= GREATEST(COALESCE(NULLIF(p.safe_stock, 0), 1), 1) THEN 2
                        WHEN COALESCE(r.outbound_count, 0) = 0 THEN 3
                        ELSE 4
                    END,
                    COALESCE(r.outbound_count, 0) DESC,
                    p.product_name
                """, companyId, companyId, companyId, companyId);

        Map<String, Object> summary = jdbcTemplate.queryForMap("""
                WITH inventory AS (
                    SELECT
                        COUNT(*) AS product_count,
                        COALESCE(SUM(real_stock), 0) AS total_stock,
                        COUNT(*) FILTER (WHERE real_stock <= 0) AS out_of_stock_count,
                        COUNT(*) FILTER (
                            WHERE real_stock > 0
                              AND real_stock <= GREATEST(COALESCE(NULLIF(safe_stock, 0), 1), 1)
                        ) AS low_stock_count
                    FROM product
                    WHERE company_id = ?
                ),
                outbound AS (
                    SELECT
                        COALESCE(SUM(outbound_count) FILTER (WHERE outbound_date = CURRENT_DATE), 0) AS today_outbound_count,
                        COALESCE(SUM(outbound_count) FILTER (WHERE outbound_date >= CURRENT_DATE - INTERVAL '6 day'), 0) AS last_7_days_outbound_count,
                        MAX(collected_at) AS last_outbound_collected_at
                    FROM product_outbound
                    WHERE company_id = ?
                ),
                setting AS (
                    SELECT last_inventory_collected_at
                    FROM integration_settings
                    WHERE company_id = ?
                      AND integration_type = 'PLAYAUTO'
                    ORDER BY id DESC
                    LIMIT 1
                )
                SELECT
                    inventory.product_count,
                    inventory.total_stock,
                    inventory.out_of_stock_count,
                    inventory.low_stock_count,
                    outbound.today_outbound_count,
                    outbound.last_7_days_outbound_count,
                    COALESCE(setting.last_inventory_collected_at, outbound.last_outbound_collected_at) AS last_synced_at
                FROM inventory, outbound
                LEFT JOIN setting ON true
                """, companyId, companyId, companyId);

        return Map.of(
                "summary", summary,
                "rows", rows
        );
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

    public List<Map<String, Object>> getWorkTasks(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_work_task
                WHERE company_id = ?
                ORDER BY
                    CASE status
                        WHEN 'DELAYED' THEN 1
                        WHEN 'BLOCKED' THEN 2
                        WHEN 'REVIEW' THEN 3
                        WHEN 'IN_PROGRESS' THEN 4
                        WHEN 'WAITING' THEN 5
                        WHEN 'DONE' THEN 6
                        ELSE 7
                    END,
                    due_date NULLS LAST,
                    CASE priority
                        WHEN 'URGENT' THEN 1
                        WHEN 'HIGH' THEN 2
                        WHEN 'MEDIUM' THEN 3
                        ELSE 4
                    END,
                    id DESC
                """, companyId);
    }

    public List<Map<String, Object>> getWorkTasks(Long companyId, AuthUser user) {
        if (UserRole.from(user.role()) != UserRole.EMPLOYEE) {
            return getWorkTasks(companyId);
        }
        String usernameMention = "@" + user.username();
        String displayMention = user.displayName() == null || user.displayName().isBlank()
                ? usernameMention
                : "@" + normalizeMentionName(user.displayName());
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_work_task
                WHERE company_id = ?
                  AND (
                    LOWER(assignee_name) = LOWER(?)
                    OR LOWER(assignee_name) = LOWER(?)
                    OR COALESCE(request_text, '') ILIKE ?
                    OR COALESCE(request_text, '') ILIKE ?
                    OR COALESCE(review_comment, '') ILIKE ?
                    OR COALESCE(review_comment, '') ILIKE ?
                    OR COALESCE(next_action, '') ILIKE ?
                    OR COALESCE(next_action, '') ILIKE ?
                    OR COALESCE(blocker_text, '') ILIKE ?
                    OR COALESCE(blocker_text, '') ILIKE ?
                  )
                ORDER BY
                    CASE status
                        WHEN 'DELAYED' THEN 1
                        WHEN 'BLOCKED' THEN 2
                        WHEN 'REVIEW' THEN 3
                        WHEN 'IN_PROGRESS' THEN 4
                        WHEN 'WAITING' THEN 5
                        WHEN 'DONE' THEN 6
                        ELSE 7
                    END,
                    due_date NULLS LAST,
                    id DESC
                """,
                companyId,
                user.username(),
                user.displayName() == null || user.displayName().isBlank() ? user.username() : user.displayName(),
                "%" + usernameMention + "%",
                "%" + displayMention + "%",
                "%" + usernameMention + "%",
                "%" + displayMention + "%",
                "%" + usernameMention + "%",
                "%" + displayMention + "%",
                "%" + usernameMention + "%",
                "%" + displayMention + "%"
        );
    }

    public List<Map<String, Object>> getChannelCredentials(Long companyId, AuthUser user) {
        boolean canViewPassword = UserRole.from(user.role()) != UserRole.EMPLOYEE;
        return jdbcTemplate.queryForList("""
                SELECT id, company_id, channel_id, channel_name, category_name, account_type, login_url, username,
                       password_cipher, password_change_note, review_username, review_password_cipher,
                       memo, status, updated_by, updated_at
                FROM executive_channel_credential
                WHERE company_id = ?
                ORDER BY
                    CASE channel_id
                        WHEN 'smartstore' THEN 1
                        WHEN 'imweb' THEN 2
                        WHEN 'coupang' THEN 3
                        WHEN 'auction' THEN 4
                        WHEN 'elevenst' THEN 5
                        ELSE 9
                    END,
                    channel_name
                """, companyId).stream().map(row -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", row.get("id"));
            result.put("company_id", row.get("company_id"));
            result.put("channel_id", row.get("channel_id"));
            result.put("channel_name", row.get("channel_name"));
            result.put("category_name", row.get("category_name"));
            result.put("account_type", row.get("account_type"));
            result.put("login_url", row.get("login_url"));
            result.put("username", row.get("username"));
            result.put("has_password", row.get("password_cipher") != null);
            result.put("password", canViewPassword && row.get("password_cipher") != null
                    ? EncryptionUtil.decrypt(String.valueOf(row.get("password_cipher")))
                    : null);
            result.put("password_change_note", row.get("password_change_note"));
            result.put("review_username", row.get("review_username"));
            result.put("has_review_password", row.get("review_password_cipher") != null);
            result.put("review_password", canViewPassword && row.get("review_password_cipher") != null
                    ? EncryptionUtil.decrypt(String.valueOf(row.get("review_password_cipher")))
                    : null);
            result.put("memo", row.get("memo"));
            result.put("status", row.get("status"));
            result.put("updated_by", row.get("updated_by"));
            result.put("updated_at", row.get("updated_at"));
            result.put("password_visible", canViewPassword);
            return result;
        }).toList();
    }

    public Map<String, Object> saveChannelCredential(Long companyId, Map<String, Object> payload, AuthUser user) {
        requireManager(user);
        String channelId = requiredText(payload.get("channel_id"), "channel_id");
        String channelName = requiredText(payload.get("channel_name"), "channel_name");
        String loginUrl = requiredText(payload.get("login_url"), "login_url");
        String categoryName = optionalText(payload.get("category_name"));
        String accountType = optionalText(payload.get("account_type"));
        String username = optionalText(payload.get("username"));
        String passwordChangeNote = optionalText(payload.get("password_change_note"));
        String reviewUsername = optionalText(payload.get("review_username"));
        String memo = optionalText(payload.get("memo"));
        String status = optionalText(payload.get("status"));
        if (status == null) {
            status = "ACTIVE";
        }

        String password = optionalText(payload.get("password"));
        String reviewPassword = optionalText(payload.get("review_password"));
        if (password != null || reviewPassword != null) {
            jdbcTemplate.update("""
                    INSERT INTO executive_channel_credential (
                        company_id, channel_id, channel_name, category_name, account_type, login_url, username,
                        password_cipher, password_change_note, review_username, review_password_cipher,
                        memo, status, created_by, updated_by
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (company_id, channel_id)
                    DO UPDATE SET
                        channel_name = EXCLUDED.channel_name,
                        category_name = EXCLUDED.category_name,
                        account_type = EXCLUDED.account_type,
                        login_url = EXCLUDED.login_url,
                        username = EXCLUDED.username,
                        password_cipher = COALESCE(EXCLUDED.password_cipher, executive_channel_credential.password_cipher),
                        password_change_note = EXCLUDED.password_change_note,
                        review_username = EXCLUDED.review_username,
                        review_password_cipher = COALESCE(EXCLUDED.review_password_cipher, executive_channel_credential.review_password_cipher),
                        memo = EXCLUDED.memo,
                        status = EXCLUDED.status,
                        updated_by = EXCLUDED.updated_by,
                        updated_at = NOW()
                    """, companyId, channelId, channelName, categoryName, accountType, loginUrl, username,
                    password != null ? EncryptionUtil.encrypt(password) : null,
                    passwordChangeNote, reviewUsername,
                    reviewPassword != null ? EncryptionUtil.encrypt(reviewPassword) : null,
                    memo, status, user.username(), user.username());
        } else {
            jdbcTemplate.update("""
                    INSERT INTO executive_channel_credential (
                        company_id, channel_id, channel_name, category_name, account_type, login_url, username,
                        password_change_note, review_username, memo, status, created_by, updated_by
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (company_id, channel_id)
                    DO UPDATE SET
                        channel_name = EXCLUDED.channel_name,
                        category_name = EXCLUDED.category_name,
                        account_type = EXCLUDED.account_type,
                        login_url = EXCLUDED.login_url,
                        username = EXCLUDED.username,
                        password_change_note = EXCLUDED.password_change_note,
                        review_username = EXCLUDED.review_username,
                        memo = EXCLUDED.memo,
                        status = EXCLUDED.status,
                        updated_by = EXCLUDED.updated_by,
                        updated_at = NOW()
                    """, companyId, channelId, channelName, categoryName, accountType, loginUrl, username,
                    passwordChangeNote, reviewUsername, memo, status, user.username(), user.username());
        }

        return getChannelCredentials(companyId, user).stream()
                .filter(row -> channelId.equals(row.get("channel_id")))
                .findFirst()
                .orElseThrow();
    }

    private void requireManager(AuthUser user) {
        UserRole role = UserRole.from(user.role());
        if (role != UserRole.MANAGER && role != UserRole.EXECUTIVE) {
            throw new CustomException(403, "?온?귐딆쁽筌?筌?쑬瑗??④쑴???類ｋ궖????륁젟??????됰뮸??덈뼄.");
        }
    }

    private String requiredText(Object value, String fieldName) {
        String text = optionalText(value);
        if (text == null) {
            throw new CustomException(400, fieldName + " is required.");
        }
        return text;
    }

    private String optionalText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    public List<Map<String, Object>> getPaymentRequests(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_payment_request
                WHERE company_id = ?
                ORDER BY
                    CASE status
                        WHEN 'SUBMITTED' THEN 1
                        WHEN 'REVIEWING' THEN 2
                        WHEN 'APPROVED' THEN 3
                        WHEN 'CASH_APPLIED' THEN 4
                        WHEN 'PAID' THEN 5
                        WHEN 'RECEIVED' THEN 6
                        WHEN 'REJECTED' THEN 7
                        ELSE 8
                    END,
                    urgent DESC,
                    scheduled_date NULLS LAST,
                    id DESC
                """, companyId);
    }

    public List<Map<String, Object>> getPaymentRequests(Long companyId, AuthUser user) {
        if (UserRole.from(user.role()) != UserRole.EMPLOYEE) {
            return getPaymentRequests(companyId);
        }
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_payment_request
                WHERE company_id = ? AND LOWER(requester_name) = LOWER(?)
                ORDER BY
                    CASE status
                        WHEN 'SUBMITTED' THEN 1
                        WHEN 'REVIEWING' THEN 2
                        WHEN 'APPROVED' THEN 3
                        WHEN 'CASH_APPLIED' THEN 4
                        WHEN 'PAID' THEN 5
                        WHEN 'RECEIVED' THEN 6
                        WHEN 'REJECTED' THEN 7
                        ELSE 8
                    END,
                    urgent DESC,
                    scheduled_date NULLS LAST,
                    id DESC
                """, companyId, user.username());
    }

    /**
     * 통합 자금현황 — 한 달의 나간 돈(지출)·들어온 돈(입금)을 한 화면에 모은다.
     * 지출: 확정 현금흐름(OUTFLOW) + 아직 승인 안 된 지출결의(대기).
     * 입금: 현금흐름(INFLOW) — 온라인 정산 자동연동·컨설팅·수기 포함.
     */
    public Map<String, Object> getCashPosition(Long companyId, String month) {
        LocalDate monthStart;
        try {
            java.time.YearMonth ym = java.time.YearMonth.parse(month);
            monthStart = ym.atDay(1);
        } catch (Exception e) {
            monthStart = LocalDate.now().withDayOfMonth(1);
        }
        LocalDate monthEnd = monthStart.plusMonths(1).minusDays(1);
        java.sql.Date start = java.sql.Date.valueOf(monthStart);
        java.sql.Date end = java.sql.Date.valueOf(monthEnd);

        // 지출 (OUTFLOW) — 현금흐름 + 지출결의 상세 결합
        List<Map<String, Object>> expenses = jdbcTemplate.queryForList("""
                SELECT cf.id, cf.flow_date, cf.category, cf.counterparty, cf.amount, cf.status,
                       cf.confidence_level, cf.source_type, cf.memo,
                       pr.id AS request_id, pr.purpose, pr.requester_name, pr.department,
                       pr.evidence_url, pr.expense_category, pr.status AS request_status
                FROM executive_cash_flow cf
                LEFT JOIN executive_payment_request pr ON pr.cash_flow_id = cf.id
                WHERE cf.company_id = ? AND cf.flow_type = 'OUTFLOW'
                  AND cf.flow_date BETWEEN ? AND ?
                ORDER BY cf.flow_date, cf.id
                """, companyId, start, end);

        // 입금 (INFLOW)
        List<Map<String, Object>> deposits = jdbcTemplate.queryForList("""
                SELECT id, flow_date, category, counterparty, amount, status,
                       confidence_level, source_type, memo
                FROM executive_cash_flow cf
                WHERE cf.company_id = ? AND cf.flow_type = 'INFLOW'
                  AND cf.flow_date BETWEEN ? AND ?
                ORDER BY cf.flow_date, cf.id
                """, companyId, start, end);

        // 승인 대기 지출결의 (아직 현금흐름에 반영 안 됨)
        List<Map<String, Object>> pending = jdbcTemplate.queryForList("""
                SELECT id AS request_id, scheduled_date AS flow_date, expense_category AS category,
                       counterparty, amount, status, purpose, requester_name, department,
                       evidence_url, urgent
                FROM executive_payment_request
                WHERE company_id = ? AND flow_type = 'OUTFLOW'
                  AND cash_flow_id IS NULL
                  AND status NOT IN ('REJECTED', 'CASH_APPLIED')
                  AND scheduled_date BETWEEN ? AND ?
                ORDER BY urgent DESC, scheduled_date, id
                """, companyId, start, end);

        Map<String, Object> sums = jdbcTemplate.queryForMap("""
                SELECT
                    COALESCE(SUM(amount) FILTER (WHERE flow_type = 'INFLOW'), 0) AS inflow,
                    COALESCE(SUM(amount) FILTER (WHERE flow_type = 'OUTFLOW'), 0) AS outflow,
                    COALESCE(SUM(amount) FILTER (WHERE flow_type = 'INFLOW'
                        AND (confidence_level = 'CONFIRMED' OR status = 'DONE')), 0) AS confirmed_inflow,
                    COALESCE(SUM(amount) FILTER (WHERE flow_type = 'OUTFLOW'
                        AND (confidence_level = 'CONFIRMED' OR status = 'DONE')), 0) AS confirmed_outflow
                FROM executive_cash_flow
                WHERE company_id = ? AND flow_date BETWEEN ? AND ?
                """, companyId, start, end);

        BigDecimal inflow = decimalValue(sums.get("inflow"));
        BigDecimal outflow = decimalValue(sums.get("outflow"));
        BigDecimal pendingAmount = pending.stream()
                .map(p -> decimalValue(p.get("amount")))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("inflow", inflow);
        summary.put("outflow", outflow);
        summary.put("net", inflow.subtract(outflow));
        summary.put("confirmedInflow", decimalValue(sums.get("confirmed_inflow")));
        summary.put("confirmedOutflow", decimalValue(sums.get("confirmed_outflow")));
        summary.put("pendingApprovalCount", pending.size());
        summary.put("pendingApprovalAmount", pendingAmount);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("month", monthStart.toString().substring(0, 7));
        result.put("monthStart", monthStart.toString());
        result.put("monthEnd", monthEnd.toString());
        result.put("summary", summary);
        result.put("expenses", expenses);
        result.put("deposits", deposits);
        result.put("pendingApprovals", pending);
        return result;
    }

    public Map<String, Object> approvePaymentRequest(Long id) {
        Map<String, Object> request = jdbcTemplate.queryForMap("""
                SELECT *
                FROM executive_payment_request
                WHERE id = ?
                """, id);
        Object existingCashFlowId = request.get("cash_flow_id");
        if (existingCashFlowId != null) {
            jdbcTemplate.update("""
                    UPDATE executive_payment_request
                    SET status = 'CASH_APPLIED', review_comment = COALESCE(review_comment, '현금흐름 반영 완료')
                    WHERE id = ?
                    """, id);
            return jdbcTemplate.queryForMap("SELECT * FROM executive_payment_request WHERE id = ?", id);
        }

        jdbcTemplate.update("""
                INSERT INTO executive_cash_flow (
                    company_id, flow_date, flow_type, category, counterparty, amount,
                    status, confidence_level, recurring_rule, source_type, source_key, memo
                )
                VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED', 'CONFIRMED', 'NONE', 'PAYMENT_REQUEST', ?, ?)
                """,
                request.get("company_id"),
                request.get("scheduled_date"),
                request.get("flow_type"),
                request.get("expense_category"),
                request.get("counterparty"),
                request.get("amount"),
                String.valueOf(id),
                "[지출결의 승인] " + request.get("purpose")
        );

        Long cashFlowId = jdbcTemplate.queryForObject("""
                SELECT id
                FROM executive_cash_flow
                WHERE source_type = 'PAYMENT_REQUEST' AND source_key = ?
                ORDER BY id DESC
                LIMIT 1
                """, Long.class, String.valueOf(id));

        jdbcTemplate.update("""
                UPDATE executive_payment_request
                SET status = 'CASH_APPLIED', cash_flow_id = ?, review_comment = '승인되어 현금흐름에 반영되었습니다.'
                WHERE id = ?
                """, cashFlowId, id);

        return jdbcTemplate.queryForMap("SELECT * FROM executive_payment_request WHERE id = ?", id);
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
        return getChannelSalesAnalytics(companyId, startDate, endDate, null);
    }

    public Map<String, Object> getChannelSalesAnalytics(Long companyId, LocalDate startDate, LocalDate endDate, Long brandId) {
        return getChannelSalesAnalytics(companyId, startDate, endDate, brandId, null);
    }

    public Map<String, Object> getChannelSalesAnalytics(Long companyId, LocalDate startDate, LocalDate endDate, Long brandId, String search) {
        return getChannelSalesAnalytics(companyId, startDate, endDate, brandId, search, null);
    }

    public Map<String, Object> getChannelSalesAnalytics(Long companyId, LocalDate startDate, LocalDate endDate, Long brandId, String search, String productGroup) {
        return getChannelSalesAnalytics(companyId, startDate, endDate, brandId, search, productGroup, null);
    }

    public Map<String, Object> getChannelSalesAnalytics(Long companyId, LocalDate startDate, LocalDate endDate, Long brandId, String search, String productGroup, String channel) {
        LocalDate resolvedEndDate = endDate != null ? endDate : LocalDate.now();
        LocalDate resolvedStartDate = startDate != null ? startDate : resolvedEndDate.withDayOfMonth(1);
        String searchKeyword = search == null || search.trim().isEmpty() ? null : search.trim();
        String productGroupKeyword = productGroup == null || productGroup.trim().isEmpty() ? null : productGroup.trim();
        String channelKeyword = channel == null || channel.trim().isEmpty() ? null : channel.trim();
        String brandKeyword = brandId == null ? null : jdbcTemplate.queryForObject(
                "SELECT brand_name FROM brand WHERE id = ? AND company_id = ?",
                String.class,
                brandId,
                companyId
        );
        String cpcKeyword = firstNonBlankValue(searchKeyword, productGroupKeyword, brandKeyword);

        List<Map<String, Object>> channels = jdbcTemplate.queryForList("""
                WITH playauto AS (
                    SELECT
                        s.shop_name AS channel_name,
                        CASE WHEN s.shop_code LIKE 'OFF-%' THEN 'OFFLINE_SHEET' ELSE 'PLAYAUTO' END AS source_type,
                        ROUND(COALESCE(SUM(o.pay_amt), 0), 0) AS sales_amount,
                        COUNT(*)::int AS order_count,
                        0::numeric AS ad_cost,
                        ROUND(COALESCE(SUM(o.pay_amt), 0)
                            - COALESCE(SUM(COALESCE(NULLIF(p.product_price, 0), matched_profit.selling_price, 0) * 0.40 * COALESCE(o.order_quantity, 1)), 0), 0) AS estimated_operating_profit
                    FROM orders o
                    JOIN shop s ON s.id = o.shop_id
                    LEFT JOIN product p ON p.id = o.product_id
                    LEFT JOIN brand b ON b.id = o.brand_id
                    LEFT JOIN LATERAL (
                        SELECT e.selling_price
                        FROM executive_product_profit e
                        WHERE e.company_id = o.company_id
                          AND (
                              e.sku = p.sku_cd
                              OR p.product_name ILIKE CONCAT('%', e.product_name, '%')
                              OR e.product_name ILIKE CONCAT('%', p.product_name, '%')
                          )
                        ORDER BY LENGTH(e.product_name) DESC
                        LIMIT 1
                    ) matched_profit ON true
                    WHERE o.company_id = ?
                      AND o.ord_time::date BETWEEN ? AND ?
                      AND s.shop_code <> 'A000'
                      AND o.ord_status NOT IN ('취소완료', '반품완료', '교환완료', '맞교환완료', '주문취소')
                      AND (?::text IS NULL OR s.shop_name ILIKE CONCAT('%', ?::text, '%'))
                      AND (?::bigint IS NULL OR o.brand_id = ?::bigint)
                      AND (?::text IS NULL
                           OR p.product_name ILIKE CONCAT('%', ?::text, '%')
                           OR p.sku_cd ILIKE CONCAT('%', ?::text, '%')
                           OR b.brand_name ILIKE CONCAT('%', ?::text, '%'))
                      AND (?::text IS NULL OR p.product_name ILIKE CONCAT('%', ?::text, '%'))
                    GROUP BY s.shop_name, CASE WHEN s.shop_code LIKE 'OFF-%' THEN 'OFFLINE_SHEET' ELSE 'PLAYAUTO' END
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
                      AND COALESCE(source_type, 'MANUAL') NOT IN ('PLAYAUTO', 'DIRECT_API')
                      AND report_month BETWEEN ? AND ?
                      AND (?::text IS NULL)
                      AND (?::text IS NULL)
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
                """, companyId, resolvedStartDate, resolvedEndDate, channelKeyword, channelKeyword, brandId, brandId,
                searchKeyword, searchKeyword, searchKeyword, searchKeyword,
                productGroupKeyword, productGroupKeyword,
                companyId, resolvedStartDate, resolvedEndDate, channelKeyword, searchKeyword);

        List<Map<String, Object>> products = jdbcTemplate.queryForList("""
                SELECT
                    s.shop_name AS channel_name,
                    p.product_name,
                    p.sku_cd AS sku,
                    b.brand_name,
                    ROUND(COALESCE(SUM(o.pay_amt), 0), 0) AS sales_amount,
                    COUNT(*)::int AS order_count,
                    -- 기존 추정치 (원가 DB 없을 때 fallback)
                    ROUND(COALESCE(AVG(COALESCE(NULLIF(p.product_price, 0), matched_profit.selling_price, 0) * 0.40), 0), 0) AS unit_cost,
                    ROUND(COALESCE(SUM(COALESCE(NULLIF(p.product_price, 0), matched_profit.selling_price, 0) * 0.40 * COALESCE(o.order_quantity, 1)), 0), 0) AS estimated_cost,
                    0::numeric AS ad_cost,
                    ROUND(COALESCE(SUM(o.pay_amt), 0)
                        - COALESCE(SUM(COALESCE(NULLIF(p.product_price, 0), matched_profit.selling_price, 0) * 0.40 * COALESCE(o.order_quantity, 1)), 0), 0) AS estimated_operating_profit,
                    CASE
                        WHEN COALESCE(SUM(o.pay_amt), 0) = 0 THEN 0
                        ELSE ROUND((COALESCE(SUM(o.pay_amt), 0)
                            - COALESCE(SUM(COALESCE(NULLIF(p.product_price, 0), matched_profit.selling_price, 0) * 0.40 * COALESCE(o.order_quantity, 1)), 0))
                            / COALESCE(SUM(o.pay_amt), 0) * 100, 1)
                    END AS estimated_operating_margin,
                    -- 실제 원가 기반 (product_cost_channel 데이터 존재 시)
                    CASE WHEN MAX(pcc.id) IS NOT NULL THEN true ELSE false END AS has_actual_cost,
                    ROUND(COALESCE(MAX(pcc.production_cost), 0) * COALESCE(SUM(o.order_quantity), 0), 0) AS actual_production_cost,
                    ROUND(COALESCE(MAX(logistics.fee), 0)     * COALESCE(SUM(o.order_quantity), 0), 0) AS actual_logistics_cost,
                    ROUND(COALESCE(MAX(pcc.channel_fee_rate), 0) * COALESCE(SUM(o.pay_amt), 0), 0) AS actual_channel_fee,
                    ROUND(COALESCE(MAX(pcc.marketing_rate),  0) * COALESCE(SUM(o.pay_amt), 0), 0) AS actual_marketing_cost,
                    ROUND(COALESCE(MAX(pcc.ad_rate),         0) * COALESCE(SUM(o.pay_amt), 0), 0) AS actual_ad_cost,
                    ROUND(COALESCE(MAX(pcc.opex_rate),       0) * COALESCE(SUM(o.pay_amt), 0), 0) AS actual_opex_cost,
                    ROUND(
                        COALESCE(SUM(o.pay_amt), 0)
                        - COALESCE(MAX(pcc.production_cost),   0) * COALESCE(SUM(o.order_quantity), 0)
                        - COALESCE(MAX(logistics.fee),         0) * COALESCE(SUM(o.order_quantity), 0)
                        - COALESCE(MAX(pcc.channel_fee_rate),  0) * COALESCE(SUM(o.pay_amt), 0)
                        - COALESCE(MAX(pcc.marketing_rate),    0) * COALESCE(SUM(o.pay_amt), 0)
                        - COALESCE(MAX(pcc.ad_rate),           0) * COALESCE(SUM(o.pay_amt), 0)
                        - COALESCE(MAX(pcc.opex_rate),         0) * COALESCE(SUM(o.pay_amt), 0)
                    , 0) AS actual_operating_profit,
                    CASE WHEN COALESCE(SUM(o.pay_amt), 0) = 0 THEN 0 ELSE
                        ROUND(100.0 * (
                            COALESCE(SUM(o.pay_amt), 0)
                            - COALESCE(MAX(pcc.production_cost),   0) * COALESCE(SUM(o.order_quantity), 0)
                            - COALESCE(MAX(logistics.fee),         0) * COALESCE(SUM(o.order_quantity), 0)
                            - COALESCE(MAX(pcc.channel_fee_rate),  0) * COALESCE(SUM(o.pay_amt), 0)
                            - COALESCE(MAX(pcc.marketing_rate),    0) * COALESCE(SUM(o.pay_amt), 0)
                            - COALESCE(MAX(pcc.ad_rate),           0) * COALESCE(SUM(o.pay_amt), 0)
                            - COALESCE(MAX(pcc.opex_rate),         0) * COALESCE(SUM(o.pay_amt), 0)
                        ) / COALESCE(SUM(o.pay_amt), 0), 1)
                    END AS actual_margin
                FROM orders o
                JOIN shop s ON s.id = o.shop_id
                JOIN product p ON p.id = o.product_id
                JOIN brand b ON b.id = o.brand_id
                LEFT JOIN LATERAL (
                    SELECT e.selling_price
                    FROM executive_product_profit e
                    WHERE e.company_id = o.company_id
                      AND (
                          e.sku = p.sku_cd
                          OR p.product_name ILIKE CONCAT('%', e.product_name, '%')
                          OR e.product_name ILIKE CONCAT('%', p.product_name, '%')
                      )
                    ORDER BY LENGTH(e.product_name) DESC
                    LIMIT 1
                ) matched_profit ON true
                LEFT JOIN LATERAL (
                    SELECT cost.*
                    FROM product_cost_channel cost
                    WHERE cost.company_id = o.company_id
                      AND cost.is_active = TRUE
                      AND (
                          CASE REPLACE(s.shop_name, ' ', '')
                              WHEN '스마트스토어' THEN '스마트스토어팜'
                              WHEN '아임웹' THEN '자사몰'
                              ELSE REPLACE(s.shop_name, ' ', '')
                          END
                      ) = REPLACE(cost.channel_name, ' ', '')
                      AND (
                          NULLIF(cost.sku_code, '') = p.sku_cd
                          OR cost.product_code = p.prod_no::text
                          OR regexp_replace(lower(COALESCE(p.product_name, '')), '[^0-9a-z가-힣]+', '', 'g')
                             LIKE CONCAT('%', regexp_replace(lower(COALESCE(cost.product_name, '')), '[^0-9a-z가-힣]+', '', 'g'), '%')
                          OR regexp_replace(lower(COALESCE(cost.product_name, '')), '[^0-9a-z가-힣]+', '', 'g')
                             LIKE CONCAT('%', regexp_replace(lower(COALESCE(p.product_name, '')), '[^0-9a-z가-힣]+', '', 'g'), '%')
                          OR regexp_replace(lower(regexp_replace(COALESCE(p.product_name, ''), '\\([^)]*\\)|[0-9]+장x[0-9]+팩|[0-9]+팩', '', 'g')), '[^0-9a-z가-힣]+', '', 'g')
                             LIKE CONCAT('%', regexp_replace(lower(regexp_replace(COALESCE(cost.product_name, ''), '^(하이프리|국민한상)\\s*', '', 'g')), '[^0-9a-z가-힣]+', '', 'g'), '%')
                          OR (
                              LENGTH(regexp_replace(lower(regexp_replace(COALESCE(cost.product_name, ''), '\\s*[0-9]+박스.*$', '')), '[^0-9a-z가-힣]+', '', 'g')) >= 3
                              AND regexp_replace(lower(replace(COALESCE(p.product_name, ''), 'box', '박스')), '[^0-9a-z가-힣]+', '', 'g')
                                  LIKE CONCAT('%', regexp_replace(lower(regexp_replace(COALESCE(cost.product_name, ''), '\\s*[0-9]+박스.*$', '')), '[^0-9a-z가-힣]+', '', 'g'), '%')
                              AND (
                                  substring(COALESCE(cost.product_name, '') from '([0-9]+)박스') IS NULL
                                  OR regexp_replace(lower(replace(COALESCE(p.product_name, ''), 'box', '박스')), '[^0-9a-z가-힣]+', '', 'g')
                                     LIKE CONCAT('%', substring(COALESCE(cost.product_name, '') from '([0-9]+)박스'), '박스%')
                              )
                          )
                      )
                    ORDER BY
                        CASE
                            WHEN NULLIF(cost.sku_code, '') = p.sku_cd THEN 0
                            WHEN cost.product_code = p.prod_no::text THEN 1
                            ELSE 2
                        END,
                        LENGTH(cost.product_name) DESC
                    LIMIT 1
                ) pcc ON TRUE
                LEFT JOIN product_sku_master psm
                    ON psm.company_id = o.company_id
                    AND psm.sku_code = p.sku_cd
                LEFT JOIN LATERAL (
                    SELECT lfc.fee
                    FROM logistics_fee_config lfc
                    WHERE lfc.company_id = o.company_id
                      AND lfc.temp_type = COALESCE(psm.temp_type, '상온')
                      AND lfc.weight_limit_g >= COALESCE(psm.weight_g, 0)
                    ORDER BY lfc.weight_limit_g ASC
                    LIMIT 1
                ) logistics ON true
                WHERE o.company_id = ?
                  AND o.ord_time::date BETWEEN ? AND ?
                  AND s.shop_code <> 'A000'
                  AND o.ord_status NOT IN ('취소완료', '반품완료', '교환완료', '맞교환완료', '주문취소')
                  AND (?::text IS NULL OR s.shop_name ILIKE CONCAT('%', ?::text, '%'))
                  AND (?::bigint IS NULL OR o.brand_id = ?::bigint)
                  AND (?::text IS NULL
                       OR p.product_name ILIKE CONCAT('%', ?::text, '%')
                       OR p.sku_cd ILIKE CONCAT('%', ?::text, '%')
                       OR b.brand_name ILIKE CONCAT('%', ?::text, '%'))
                  AND (?::text IS NULL OR p.product_name ILIKE CONCAT('%', ?::text, '%'))
                GROUP BY s.shop_name, p.product_name, p.sku_cd, b.brand_name
                HAVING COALESCE(SUM(o.pay_amt), 0) <> 0 OR COUNT(*) <> 0
                ORDER BY sales_amount DESC, order_count DESC
                """, companyId, resolvedStartDate, resolvedEndDate, channelKeyword, channelKeyword, brandId, brandId,
                searchKeyword, searchKeyword, searchKeyword, searchKeyword,
                productGroupKeyword, productGroupKeyword);

        BigDecimal filteredNaverCpcCost = loadFilteredNaverCpcCost(resolvedStartDate, resolvedEndDate, cpcKeyword);
        BigDecimal cpcSalesBase = products.stream()
                .filter(r -> Boolean.TRUE.equals(r.get("has_actual_cost")))
                .map(r -> decimalValue(r.get("sales_amount")))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        for (Map<String, Object> product : products) {
            if (!Boolean.TRUE.equals(product.get("has_actual_cost"))) {
                product.put("actual_ad_cost", BigDecimal.ZERO);
                product.put("actual_operating_profit", BigDecimal.ZERO);
                product.put("actual_margin", BigDecimal.ZERO);
                continue;
            }

            BigDecimal salesAmount = decimalValue(product.get("sales_amount"));
            BigDecimal allocatedCpc = BigDecimal.ZERO;
            if (cpcSalesBase.compareTo(BigDecimal.ZERO) > 0 && filteredNaverCpcCost.compareTo(BigDecimal.ZERO) > 0) {
                allocatedCpc = filteredNaverCpcCost
                        .multiply(salesAmount)
                        .divide(cpcSalesBase, 0, RoundingMode.HALF_UP);
            }

            BigDecimal actualOperatingProfit = salesAmount
                    .subtract(decimalValue(product.get("actual_production_cost")))
                    .subtract(decimalValue(product.get("actual_logistics_cost")))
                    .subtract(decimalValue(product.get("actual_channel_fee")))
                    .subtract(decimalValue(product.get("actual_marketing_cost")))
                    .subtract(allocatedCpc)
                    .subtract(decimalValue(product.get("actual_opex_cost")));

            product.put("actual_ad_cost", allocatedCpc);
            product.put("actual_operating_profit", actualOperatingProfit);
            product.put("actual_margin", percentValue(actualOperatingProfit, salesAmount));
        }

        Map<String, BigDecimal> mixedProfitByChannel = new HashMap<>();
        Map<String, BigDecimal> actualProfitByChannel = new HashMap<>();
        Map<String, BigDecimal> actualSalesByChannel = new HashMap<>();
        Map<String, Integer> actualProductCountByChannel = new HashMap<>();

        for (Map<String, Object> product : products) {
            String channelName = String.valueOf(product.getOrDefault("channel_name", ""));
            boolean hasActualCost = Boolean.TRUE.equals(product.get("has_actual_cost"));
            BigDecimal productProfit = hasActualCost
                    ? decimalValue(product.get("actual_operating_profit"))
                    : decimalValue(product.get("estimated_operating_profit"));

            mixedProfitByChannel.merge(channelName, productProfit, BigDecimal::add);

            if (hasActualCost) {
                actualProfitByChannel.merge(channelName, decimalValue(product.get("actual_operating_profit")), BigDecimal::add);
                actualSalesByChannel.merge(channelName, decimalValue(product.get("sales_amount")), BigDecimal::add);
                actualProductCountByChannel.merge(channelName, 1, Integer::sum);
            }
        }

        for (Map<String, Object> channelRow : channels) {
            if (!"PLAYAUTO".equalsIgnoreCase(String.valueOf(channelRow.getOrDefault("source_type", "")))) {
                continue;
            }
            String channelName = String.valueOf(channelRow.getOrDefault("channel_name", ""));
            BigDecimal mixedProfit = mixedProfitByChannel.get(channelName);
            if (mixedProfit == null) {
                continue;
            }

            BigDecimal salesAmount = decimalValue(channelRow.get("sales_amount"));
            BigDecimal actualProfit = actualProfitByChannel.getOrDefault(channelName, BigDecimal.ZERO);
            BigDecimal actualSales = actualSalesByChannel.getOrDefault(channelName, BigDecimal.ZERO);
            int actualProductCount = actualProductCountByChannel.getOrDefault(channelName, 0);

            channelRow.put("has_actual_cost", actualProductCount > 0);
            channelRow.put("actual_cost_product_count", actualProductCount);
            channelRow.put("actual_cost_sales_base", actualSales);
            channelRow.put("actual_operating_profit", actualProfit);
            channelRow.put("actual_operating_margin", percentValue(actualProfit, actualSales));
            channelRow.put("estimated_operating_profit", mixedProfit);
            channelRow.put("estimated_operating_margin", percentValue(mixedProfit, salesAmount));
        }

        BigDecimal totalSales = channels.stream()
                .map(row -> decimalValue(row.get("sales_amount")))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalProfit = channels.stream()
                .map(row -> decimalValue(row.get("estimated_operating_profit")))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int totalOrders = channels.stream()
                .mapToInt(row -> ((Number) row.getOrDefault("order_count", 0)).intValue())
                .sum();
        BigDecimal totalAdCost = filteredNaverCpcCost;

        // 실제 원가 기반 합계 (product_cost_channel 데이터 있는 제품만)
        long actualCostProductCount = products.stream()
                .filter(r -> Boolean.TRUE.equals(r.get("has_actual_cost")))
                .count();
        BigDecimal actualSalesBase = products.stream()
                .filter(r -> Boolean.TRUE.equals(r.get("has_actual_cost")))
                .map(r -> decimalValue(r.get("sales_amount")))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal actualOperatingProfit = products.stream()
                .filter(r -> Boolean.TRUE.equals(r.get("has_actual_cost")))
                .map(r -> decimalValue(r.get("actual_operating_profit")))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 온라인/오프라인 분리 합계 (오프라인 = 발주시트 직연동 + 수기 오프라인 채널)
        BigDecimal offlineSalesTotal = BigDecimal.ZERO;
        int offlineOrdersTotal = 0;
        for (Map<String, Object> row : channels) {
            String srcType = String.valueOf(row.getOrDefault("source_type", "")).toUpperCase();
            String chName = String.valueOf(row.getOrDefault("channel_name", ""));
            boolean offline = "OFFLINE_SHEET".equals(srcType) || "OFFLINE".equals(srcType)
                    || chName.contains("오프라인") || chName.contains("매장");
            if (offline) {
                offlineSalesTotal = offlineSalesTotal.add(decimalValue(row.get("sales_amount")));
                offlineOrdersTotal += ((Number) row.getOrDefault("order_count", 0)).intValue();
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("salesAmount", totalSales);
        summary.put("orderCount", totalOrders);
        summary.put("onlineSales", totalSales.subtract(offlineSalesTotal));
        summary.put("offlineSales", offlineSalesTotal);
        summary.put("onlineOrders", totalOrders - offlineOrdersTotal);
        summary.put("offlineOrders", offlineOrdersTotal);
        summary.put("averageOrderValue", totalOrders > 0
                ? totalSales.divide(BigDecimal.valueOf(totalOrders), 0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO);
        summary.put("adCost", totalAdCost);
        summary.put("estimatedOperatingProfit", totalProfit);
        summary.put("estimatedOperatingMargin", percentValue(totalProfit, totalSales));
        summary.put("actualCostProductCount", actualCostProductCount);
        summary.put("actualCostSalesBase", actualSalesBase);
        summary.put("actualOperatingProfit", actualOperatingProfit);
        summary.put("actualOperatingMargin", percentValue(actualOperatingProfit, actualSalesBase));

        List<Map<String, Object>> trend = jdbcTemplate.queryForList("""
                WITH playauto AS (
                    SELECT
                        o.ord_time::date AS sales_date,
                        ROUND(COALESCE(SUM(o.pay_amt), 0), 0) AS sales_amount,
                        COUNT(*)::int AS order_count,
                        ROUND(COALESCE(SUM(CASE WHEN s.shop_code LIKE 'OFF-%' THEN o.pay_amt ELSE 0 END), 0), 0) AS offline_amount,
                        COALESCE(SUM(CASE WHEN s.shop_code LIKE 'OFF-%' THEN 1 ELSE 0 END), 0)::int AS offline_orders
                    FROM orders o
                    LEFT JOIN product p ON p.id = o.product_id
                    LEFT JOIN brand b ON b.id = o.brand_id
                    JOIN shop s ON s.id = o.shop_id
                    WHERE o.company_id = ?
                      AND o.ord_time::date BETWEEN ? AND ?
                      AND s.shop_code <> 'A000'
                      AND o.ord_status NOT IN ('취소완료', '반품완료', '교환완료', '맞교환완료', '주문취소')
                      AND (?::text IS NULL OR s.shop_name ILIKE CONCAT('%', ?::text, '%'))
                      AND (?::bigint IS NULL OR o.brand_id = ?::bigint)
                      AND (?::text IS NULL
                           OR p.product_name ILIKE CONCAT('%', ?::text, '%')
                           OR p.sku_cd ILIKE CONCAT('%', ?::text, '%')
                           OR b.brand_name ILIKE CONCAT('%', ?::text, '%'))
                      AND (?::text IS NULL OR p.product_name ILIKE CONCAT('%', ?::text, '%'))
                    GROUP BY o.ord_time::date
                ),
                manual AS (
                    SELECT
                        report_month::date AS sales_date,
                        ROUND(COALESCE(SUM(sales_amount), 0), 0) AS sales_amount,
                        COALESCE(SUM(order_count), 0)::int AS order_count,
                        0::numeric AS offline_amount,
                        0::int AS offline_orders
                    FROM executive_channel_performance
                    WHERE company_id = ?
                      AND COALESCE(source_type, 'MANUAL') NOT IN ('PLAYAUTO', 'DIRECT_API')
                      AND report_month BETWEEN ? AND ?
                      AND (?::text IS NULL)
                      AND (?::text IS NULL)
                    GROUP BY report_month::date
                ),
                combined AS (
                    SELECT * FROM playauto
                    UNION ALL
                    SELECT * FROM manual
                )
                SELECT
                    sales_date,
                    ROUND(COALESCE(SUM(sales_amount), 0), 0) AS sales_amount,
                    COALESCE(SUM(order_count), 0)::int AS order_count,
                    ROUND(COALESCE(SUM(offline_amount), 0), 0) AS offline_amount,
                    COALESCE(SUM(offline_orders), 0)::int AS offline_orders
                FROM combined
                GROUP BY sales_date
                ORDER BY sales_date
                """, companyId, resolvedStartDate, resolvedEndDate, channelKeyword, channelKeyword, brandId, brandId,
                searchKeyword, searchKeyword, searchKeyword, searchKeyword,
                productGroupKeyword, productGroupKeyword,
                companyId, resolvedStartDate, resolvedEndDate, channelKeyword, searchKeyword);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("startDate", resolvedStartDate);
        result.put("endDate", resolvedEndDate);
        result.put("summary", summary);
        result.put("trend", trend);
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
                      AND s.shop_code <> 'A000'
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
                  AND s.shop_code <> 'A000'
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
                SELECT
                    r.*,
                    COALESCE(p.partner_name, r.partner_name) AS partner_name,
                    COALESCE(p.partner_type, r.partner_type) AS partner_type,
                    COALESCE(p.business_scope, r.business_scope) AS business_scope,
                    COALESCE(p.manager_name, r.manager_name) AS manager_name,
                    COALESCE(p.owner_name, r.owner_name) AS owner_name,
                    COALESCE(p.contact, r.contact) AS contact,
                    COALESCE(p.tax_email, r.tax_email) AS tax_email,
                    COALESCE(p.bank_account, r.bank_account) AS bank_account,
                    COALESCE(p.settlement_terms, r.settlement_terms) AS settlement_terms,
                    COALESCE(p.country, r.country) AS country,
                    COALESCE(p.contract_status, r.contract_status) AS contract_status,
                    COALESCE(p.last_contact_date, r.last_contact_date) AS last_contact_date,
                    r.invoice_amount - r.paid_amount AS remaining_amount,
                    GREATEST(CURRENT_DATE - r.due_date, 0) AS overdue_days,
                    CASE
                        WHEN r.invoice_amount = 0 THEN 100
                        ELSE ROUND((r.paid_amount / r.invoice_amount) * 100, 1)
                    END AS recovery_rate
                FROM executive_receivable r
                LEFT JOIN executive_partner p ON p.id = r.partner_id
                WHERE r.company_id = ?
                ORDER BY
                    CASE r.risk_level
                        WHEN 'CRITICAL' THEN 1
                        WHEN 'HIGH' THEN 2
                        WHEN 'WATCH' THEN 3
                        ELSE 4
                    END,
                    r.due_date
                """, companyId);
    }

    public List<Map<String, Object>> getPartners(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_partner
                WHERE company_id = ?
                ORDER BY partner_name, id
                """, companyId);
    }

    public List<Map<String, Object>> getOperatingExpenses(Long companyId) {
        LocalDate currentMonth = LocalDate.now().withDayOfMonth(1);
        return jdbcTemplate.queryForList("""
                WITH params AS (
                    SELECT CAST(? AS date) AS current_month
                ),
                projected AS (
                    SELECT
                        e.*,
                        e.expense_month AS original_expense_month,
                        e.payment_date AS original_payment_date,
                        COALESCE(e.payment_date, e.expense_month) AS base_payment_date,
                        p.current_month,
                        CASE
                            WHEN e.expense_month < p.current_month THEN p.current_month
                            ELSE date_trunc('month', e.expense_month)::date
                        END AS recurring_expense_month
                    FROM executive_operating_expense e
                    CROSS JOIN params p
                    WHERE e.company_id = ?
                ),
                recurring AS (
                    SELECT
                        *,
                        CASE
                            WHEN base_payment_date IS NULL THEN recurring_expense_month
                            WHEN date_trunc('month', base_payment_date)::date >= current_month THEN base_payment_date
                            ELSE (
                                recurring_expense_month
                                + (
                                    LEAST(
                                        EXTRACT(DAY FROM base_payment_date)::int,
                                        EXTRACT(DAY FROM (recurring_expense_month + INTERVAL '1 month' - INTERVAL '1 day'))::int
                                    ) - 1
                                ) * INTERVAL '1 day'
                            )::date
                        END AS recurring_payment_date
                    FROM projected
                ),
                ranked AS (
                    SELECT
                        *,
                        ROW_NUMBER() OVER (
                            PARTITION BY category, expense_type, amount, COALESCE(vendor, ''), COALESCE(memo, '')
                            ORDER BY expense_month DESC, id DESC
                        ) AS rn
                    FROM recurring
                )
                SELECT
                    id,
                    company_id,
                    recurring_expense_month AS expense_month,
                    category,
                    expense_type,
                    amount,
                    recurring_payment_date AS payment_date,
                    vendor,
                    memo,
                    created_at,
                    original_expense_month,
                    original_payment_date,
                    CASE
                        WHEN original_expense_month < current_month THEN 'RECURRING'
                        ELSE 'CURRENT'
                    END AS recurrence_status
                FROM ranked
                WHERE rn = 1
                ORDER BY recurring_payment_date NULLS LAST, amount DESC, id DESC
                """, currentMonth, companyId);
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
                        WHEN '紐쎄낏' THEN 1
                        WHEN '?留? THEN 2
                        WHEN '?띿쉘' THEN 3
                        WHEN '踰좏듃?? THEN 4
                        ELSE 5
                    END,
                    moq,
                    product_name
                """, companyId);
    }

    public List<Map<String, Object>> getAdPerformance(Long companyId) {
        return jdbcTemplate.queryForList("""
                WITH manual_ad AS (
                    SELECT id,
                           company_id,
                           'MANUAL' AS source,
                           NULL::varchar AS ad_type,
                           '吏곸젒 ?낅젰' AS ad_type_label,
                           product_name,
                           ad_channel,
                           ad_cost,
                           click_count,
                           cpa,
                           roas,
                           conversion_rate,
                           sales_amount,
                           net_profit,
                           report_month,
                           created_at
                      FROM executive_ad_performance
                     WHERE company_id = ?
                ),
                naver_ad AS (
                    SELECT NULL::bigint AS id,
                           ?::bigint AS company_id,
                           'NAVER_SEARCH_AD' AS source,
                           ad_type,
                           CASE ad_type
                               WHEN 'POWERLINK' THEN '?뚯썙留곹겕'
                               WHEN 'SHOPPING_SEARCH' THEN '?쇳븨寃??
                               ELSE '湲고?'
                           END AS ad_type_label,
                           NULL::varchar AS product_name,
                           '?ㅼ씠踰?愿묎퀬 - ' ||
                               CASE ad_type
                                   WHEN 'POWERLINK' THEN '?뚯썙留곹겕'
                                   WHEN 'SHOPPING_SEARCH' THEN '?쇳븨寃??
                                   ELSE '湲고?'
                               END AS ad_channel,
                           COALESCE(SUM(cost), 0) AS ad_cost,
                           COALESCE(SUM(clicks), 0)::integer AS click_count,
                           CASE
                               WHEN COALESCE(SUM(conversions), 0) > 0
                               THEN ROUND(COALESCE(SUM(cost), 0) / NULLIF(SUM(conversions), 0), 2)
                               ELSE 0
                           END AS cpa,
                           CASE
                               WHEN COALESCE(SUM(cost), 0) > 0
                               THEN ROUND(COALESCE(SUM(conversion_value), 0) / NULLIF(SUM(cost), 0) * 100, 2)
                               ELSE 0
                           END AS roas,
                           CASE
                               WHEN COALESCE(SUM(clicks), 0) > 0
                               THEN ROUND(COALESCE(SUM(conversions), 0)::numeric / NULLIF(SUM(clicks), 0) * 100, 2)
                               ELSE 0
                           END AS conversion_rate,
                           COALESCE(SUM(conversion_value), 0) AS sales_amount,
                           0::numeric AS net_profit,
                           date_trunc('month', date)::date AS report_month,
                           MAX(created_at) AS created_at
                      FROM naver_cpc_daily_stats
                     GROUP BY ad_type, date_trunc('month', date)::date
                )
                SELECT *
                  FROM (
                        SELECT * FROM manual_ad
                        UNION ALL
                        SELECT * FROM naver_ad
                       ) ad_rows
                 ORDER BY report_month DESC, roas DESC, ad_cost DESC
                """, companyId, companyId);
    }

    public List<Map<String, Object>> getAdRoasGoals(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_ad_roas_goal
                WHERE company_id = ?
                ORDER BY
                    CASE status WHEN 'ACTIVE' THEN 1 ELSE 2 END,
                    end_date DESC,
                    period_type,
                    product_name NULLS LAST,
                    target_roas DESC
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

    public Map<String, Object> getCustomerDatabase(Long companyId, LocalDate startDate, LocalDate endDate) {
        Map<String, Object> summary = jdbcTemplate.queryForMap("""
                WITH valid_orders AS (
                    SELECT
                        o.customer_id,
                        o.uniq,
                        COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0) AS net_amount,
                        COALESCE(o.ord_time, o.pay_time, o.wdate, o.created_at) AS order_at
                    FROM orders o
                    WHERE o.company_id = ?
                      AND o.customer_id IS NOT NULL
                    AND (CAST(? AS DATE) IS NULL OR COALESCE(o.ord_time, o.pay_time, o.wdate, o.created_at) >= CAST(? AS DATE))
                    AND (CAST(? AS DATE) IS NULL OR COALESCE(o.ord_time, o.pay_time, o.wdate, o.created_at) < CAST(? AS DATE) + INTERVAL '1 day')
                ),
                customer_orders AS (
                    SELECT
                        c.id,
                        COUNT(DISTINCT vo.uniq) AS order_count,
                        COALESCE(SUM(vo.net_amount), 0) AS total_purchase_amount,
                        MIN(vo.order_at) AS first_order_at,
                        MAX(vo.order_at) AS last_order_at
                    FROM customer c
                    LEFT JOIN valid_orders vo ON vo.customer_id = c.id
                    WHERE c.company_id = ?
                    GROUP BY c.id
                ),
                scored AS (
                    SELECT
                        *,
                        CASE
                            WHEN order_count > 1 THEN
                                last_order_at + (
                                    GREATEST(
                                        ROUND((EXTRACT(EPOCH FROM (last_order_at - first_order_at)) / 86400 / GREATEST(order_count - 1, 1))::numeric, 1),
                                        7
                                    ) || ' days'
                                )::interval
                            WHEN last_order_at IS NOT NULL THEN last_order_at + INTERVAL '30 days'
                            ELSE NULL
                        END AS estimated_reorder_at
                    FROM customer_orders
                )
                SELECT
                    COUNT(*) FILTER (WHERE order_count > 0) AS total_customers,
                    COUNT(*) FILTER (WHERE order_count > 1) AS repeat_customers,
                    COUNT(*) FILTER (
                        WHERE estimated_reorder_at IS NOT NULL
                          AND estimated_reorder_at <= CURRENT_TIMESTAMP + INTERVAL '7 days'
                    ) AS reorder_attention_count,
                    COALESCE(SUM(order_count), 0) AS total_orders,
                    COALESCE(SUM(total_purchase_amount), 0) AS total_purchase_amount
                FROM scored
                """, companyId, startDate, startDate, endDate, endDate, companyId);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                WITH valid_orders AS (
                    SELECT
                        o.*,
                        COALESCE(o.ord_time, o.pay_time, o.wdate, o.created_at) AS order_at,
                        COALESCE(o.pay_amt, 0) - COALESCE(o.cancel_amt, 0) AS net_amount,
                        GREATEST(COALESCE(o.order_quantity, 1), 1) AS resolved_quantity
                    FROM orders o
                    WHERE o.company_id = ?
                      AND o.customer_id IS NOT NULL
                      AND (CAST(? AS DATE) IS NULL OR COALESCE(o.ord_time, o.pay_time, o.wdate, o.created_at) >= CAST(? AS DATE))
                      AND (CAST(? AS DATE) IS NULL OR COALESCE(o.ord_time, o.pay_time, o.wdate, o.created_at) < CAST(? AS DATE) + INTERVAL '1 day')
                ),
                customer_base AS (
                    SELECT
                        c.id AS customer_id,
                        c.customer_name,
                        c.customer_htel,
                        c.customer_email,
                        COUNT(DISTINCT vo.uniq) AS order_count,
                        COALESCE(SUM(vo.resolved_quantity), 0) AS total_quantity,
                        COALESCE(SUM(vo.net_amount), 0) AS total_purchase_amount,
                        MIN(vo.order_at) AS first_order_at,
                        MAX(vo.order_at) AS last_order_at,
                        CASE
                            WHEN COUNT(DISTINCT vo.uniq) > 1 THEN
                                ROUND(
                                    (EXTRACT(EPOCH FROM (MAX(vo.order_at) - MIN(vo.order_at))) / 86400
                                     / GREATEST(COUNT(DISTINCT vo.uniq) - 1, 1))::numeric,
                                    1
                                )
                            ELSE NULL
                        END AS avg_reorder_days
                    FROM customer c
                    LEFT JOIN valid_orders vo ON vo.customer_id = c.id
                    WHERE c.company_id = ?
                    GROUP BY c.id, c.customer_name, c.customer_htel, c.customer_email
                ),
                product_counts AS (
                    SELECT
                        vo.customer_id,
                        COALESCE(NULLIF(p.product_name, ''), NULLIF(vo.sku_cd, ''), '상품명 없음') AS product_name,
                        COALESCE(SUM(vo.resolved_quantity), 0) AS order_quantity
                    FROM valid_orders vo
                    LEFT JOIN product p ON p.id = vo.product_id
                    GROUP BY vo.customer_id, COALESCE(NULLIF(p.product_name, ''), NULLIF(vo.sku_cd, ''), '상품명 없음')
                ),
                product_summary AS (
                    SELECT
                        customer_id,
                        STRING_AGG(product_name || ' ' || order_quantity || '건', ', ' ORDER BY order_quantity DESC, product_name) AS ordered_products
                    FROM product_counts
                    GROUP BY customer_id
                ),
                scored AS (
                    SELECT
                        cb.*,
                        COALESCE(ps.ordered_products, '-') AS ordered_products,
                        CASE
                            WHEN cb.order_count > 1 THEN
                                cb.last_order_at + (GREATEST(COALESCE(cb.avg_reorder_days, 30), 7) || ' days')::interval
                            WHEN cb.last_order_at IS NOT NULL THEN cb.last_order_at + INTERVAL '30 days'
                            ELSE NULL
                        END AS estimated_reorder_at
                    FROM customer_base cb
                    LEFT JOIN product_summary ps ON ps.customer_id = cb.customer_id
                )
                SELECT
                    customer_id,
                    COALESCE(NULLIF(customer_name, ''), '이름 없음') AS customer_name,
                    customer_htel,
                    customer_email,
                    order_count,
                    total_quantity,
                    total_purchase_amount,
                    first_order_at,
                    last_order_at,
                    CASE
                        WHEN last_order_at IS NULL THEN NULL
                        ELSE FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_order_at)) / 86400)
                    END AS days_since_last_order,
                    avg_reorder_days,
                    estimated_reorder_at,
                    ordered_products,
                    CASE
                        WHEN order_count <= 1 THEN '신규'
                        WHEN estimated_reorder_at < CURRENT_TIMESTAMP THEN '재주문 지연'
                        WHEN estimated_reorder_at <= CURRENT_TIMESTAMP + INTERVAL '7 days' THEN '재주문 임박'
                        ELSE '관찰'
                    END AS reorder_status
                FROM scored
                WHERE order_count > 0
                ORDER BY
                    CASE
                        WHEN estimated_reorder_at < CURRENT_TIMESTAMP THEN 0
                        WHEN estimated_reorder_at <= CURRENT_TIMESTAMP + INTERVAL '7 days' THEN 1
                        ELSE 2
                    END,
                    total_purchase_amount DESC,
                    last_order_at DESC
                """, companyId, startDate, startDate, endDate, endDate, companyId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", summary);
        result.put("rows", rows);
        return result;
    }

    public Map<String, Object> getCustomerInquiries(Long companyId) {
        Map<String, Object> summary = jdbcTemplate.queryForMap("""
                SELECT
                    COUNT(*) AS total_count,
                    COUNT(*) FILTER (WHERE status <> 'DONE') AS open_count,
                    COUNT(*) FILTER (WHERE status = 'UNANSWERED') AS unanswered_count,
                    COUNT(*) FILTER (WHERE urgent = TRUE AND status <> 'DONE') AS urgent_count,
                    COUNT(*) FILTER (WHERE channel = 'KAKAO' AND status <> 'DONE') AS kakao_open_count,
                    COUNT(*) FILTER (WHERE channel = 'SMARTSTORE' AND status <> 'DONE') AS smartstore_open_count,
                    COUNT(*) FILTER (WHERE channel = 'IMWEB' AND status <> 'DONE') AS imweb_open_count
                FROM executive_customer_inquiry
                WHERE company_id = ?
                """, companyId);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT *
                FROM executive_customer_inquiry
                WHERE company_id = ?
                ORDER BY
                    CASE WHEN urgent THEN 0 ELSE 1 END,
                    CASE status
                        WHEN 'UNANSWERED' THEN 1
                        WHEN 'ASSIGNED' THEN 2
                        WHEN 'IN_PROGRESS' THEN 3
                        WHEN 'WAITING_CUSTOMER' THEN 4
                        WHEN 'DONE' THEN 5
                        ELSE 6
                    END,
                    received_at DESC
                LIMIT 80
                """, companyId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", summary);
        result.put("rows", rows);
        return result;
    }

    public Map<String, Object> createRecord(String resource, Map<String, Object> payload) {
        ResourceDefinition definition = getResourceDefinition(resource);
        Map<String, Object> values = sanitizePayload(definition, payload);
        values.putIfAbsent("company_id", 1);
        applyProductProfitCalculations(definition, values, values);
        applyProductForecastCalculations(definition, values, values);
        applyConsultingRevenueCalculations(definition, values, values);

        if (values.isEmpty()) {
            throw new IllegalArgumentException("???繞③뇡???⑥щ턄??? ??怨룸????덈펲.");
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

    public Map<String, Object> createRecord(String resource, Map<String, Object> payload, AuthUser user) {
        Map<String, Object> scopedPayload = new HashMap<>(payload);
        if (UserRole.from(user.role()) == UserRole.EMPLOYEE) {
            if ("work-tasks".equals(resource)) {
                String assigneeName = user.displayName() == null || user.displayName().isBlank()
                        ? user.username()
                        : user.displayName();
                scopedPayload.put("assignee_name", assigneeName);
            } else if ("payment-requests".equals(resource)) {
                scopedPayload.put("requester_name", user.username());
            }
        }
        return createRecord(resource, scopedPayload);
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
            throw new IllegalArgumentException("?섏젙???곗씠?곌? ?놁뒿?덈떎.");
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
            throw new IllegalArgumentException("?섏젙???곗씠?곕? 李얠쓣 ???놁뒿?덈떎.");
        }

        return getRecord(definition, id);
    }

    public Map<String, Object> updateRecord(String resource, Long id, Map<String, Object> payload, AuthUser user) {
        ensureRecordAccess(resource, id, user);
        Map<String, Object> scopedPayload = new HashMap<>(payload);
        if (UserRole.from(user.role()) == UserRole.EMPLOYEE) {
            scopedPayload.remove("assignee_name");
            scopedPayload.remove("requester_name");
            scopedPayload.remove("review_comment");
            scopedPayload.remove("cash_flow_id");
        }
        return updateRecord(resource, id, scopedPayload);
    }

    public void deleteRecord(String resource, Long id) {
        ResourceDefinition definition = getResourceDefinition(resource);
        jdbcTemplate.update("DELETE FROM " + definition.tableName() + " WHERE id = ?", id);
    }

    public void deleteRecord(String resource, Long id, AuthUser user) {
        ensureRecordAccess(resource, id, user);
        if (UserRole.from(user.role()) == UserRole.EMPLOYEE && !"work-tasks".equals(resource)) {
            throw new CustomException(403, "직원은 업무 외 데이터를 삭제할 수 없습니다. 관리자에게 요청하세요.");
        }
        deleteRecord(resource, id);
    }

    private String normalizeMentionName(String value) {
        if (value == null) return "";
        return value.trim()
                .replaceAll("\\s+", "")
                .replaceAll("(대표님|팀장님|매니저님|님|씨|대표|팀장|매니저)$", "");
    }

    private void ensureRecordAccess(String resource, Long id, AuthUser user) {
        if (UserRole.from(user.role()) != UserRole.EMPLOYEE) {
            return;
        }
        ResourceDefinition definition = getResourceDefinition(resource);
        if ("work-tasks".equals(resource)) {
            String displayName = user.displayName() == null || user.displayName().isBlank() ? user.username() : normalizeMentionName(user.displayName());
            Integer count = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*)
                    FROM %s
                    WHERE id = ?
                      AND (
                        LOWER(assignee_name) = LOWER(?)
                        OR LOWER(assignee_name) = LOWER(?)
                        OR COALESCE(request_text, '') ILIKE ?
                        OR COALESCE(request_text, '') ILIKE ?
                        OR COALESCE(review_comment, '') ILIKE ?
                        OR COALESCE(review_comment, '') ILIKE ?
                        OR COALESCE(next_action, '') ILIKE ?
                        OR COALESCE(next_action, '') ILIKE ?
                        OR COALESCE(blocker_text, '') ILIKE ?
                        OR COALESCE(blocker_text, '') ILIKE ?
                      )
                    """.formatted(definition.tableName()),
                    Integer.class,
                    id,
                    user.username(),
                    displayName,
                    "%@" + user.username() + "%",
                    "%@" + displayName + "%",
                    "%@" + user.username() + "%",
                    "%@" + displayName + "%",
                    "%@" + user.username() + "%",
                    "%@" + displayName + "%",
                    "%@" + user.username() + "%",
                    "%@" + displayName + "%"
            );
            if (count != null && count > 0) return;
        }
        if ("payment-requests".equals(resource)) {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM " + definition.tableName() + " WHERE id = ? AND LOWER(requester_name) = LOWER(?)",
                    Integer.class,
                    id,
                    user.username()
            );
            if (count != null && count > 0) return;
        }
        throw new CustomException(403, "해당 데이터에 접근 권한이 없습니다.");
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

    private String firstNonBlankValue(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return null;
    }

    private BigDecimal loadFilteredNaverCpcCost(LocalDate startDate, LocalDate endDate, String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return jdbcTemplate.queryForObject("""
                    SELECT COALESCE(SUM(cost), 0)
                      FROM naver_cpc_daily_stats
                     WHERE date BETWEEN ? AND ?
                    """, BigDecimal.class, startDate, endDate);
        }
        String normalizedKeyword = keyword.trim();
        return jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(cost), 0)
                  FROM naver_cpc_daily_stats
                 WHERE date BETWEEN ? AND ?
                   AND (
                       campaign_name ILIKE CONCAT('%', ?::text, '%')
                       OR ad_group_name ILIKE CONCAT('%', ?::text, '%')
                       OR keyword ILIKE CONCAT('%', ?::text, '%')
                   )
                """, BigDecimal.class, startDate, endDate, normalizedKeyword, normalizedKeyword, normalizedKeyword);
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
            throw new IllegalArgumentException("吏?먰븯吏 ?딅뒗 ?곗씠???곸뿭?낅땲?? " + resource);
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
            return "?꾪뿕";
        }
        if (projectedCash < 30_000_000) {
            return "二쇱쓽";
        }
        return "?뺤긽";
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

    private int countOpenCustomerInquiries(Long companyId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM executive_customer_inquiry
                WHERE company_id = ? AND status <> 'DONE'
                """, Integer.class, companyId);
        return count == null ? 0 : count;
    }

    private int countUnansweredCustomerInquiries(Long companyId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM executive_customer_inquiry
                WHERE company_id = ? AND status = 'UNANSWERED'
                """, Integer.class, companyId);
        return count == null ? 0 : count;
    }

    // ─── CEO 전략 대시보드 ────────────────────────────────────────────────────

    public Map<String, Object> getCeoFinancials(Long companyId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT * FROM executive_ceo_financials WHERE company_id = ?", companyId);
        if (rows.isEmpty()) {
            return new LinkedHashMap<>();
        }
        return new LinkedHashMap<>(rows.get(0));
    }

    public Map<String, Object> saveCeoFinancials(Long companyId, Map<String, Object> payload) {
        // 목표값만 저장 — 현금/부채/고정비는 각 전용 테이블에서 자동 집계
        jdbcTemplate.update("""
                INSERT INTO executive_ceo_financials (
                    company_id, goal_consulting, goal_online, goal_export, updated_at
                ) VALUES (?,?,?,?,NOW())
                ON CONFLICT (company_id) DO UPDATE SET
                    goal_consulting = EXCLUDED.goal_consulting,
                    goal_online     = EXCLUDED.goal_online,
                    goal_export     = EXCLUDED.goal_export,
                    updated_at      = NOW()
                """,
                companyId,
                toLong(payload, "goal_consulting"), toLong(payload, "goal_online"), toLong(payload, "goal_export")
        );
        return getCeoFinancials(companyId);
    }

    public Map<String, Object> getCeoDashboard(Long companyId) {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate prevMonthStart = monthStart.minusMonths(1);
        LocalDate prevMonthEnd = monthStart.minusDays(1);
        int daysInMonth = today.lengthOfMonth();
        int daysPassed  = today.getDayOfMonth();

        // ── 목표값 (manual) ─────────────────────────────────────────────────
        Map<String, Object> fin = getCeoFinancials(companyId);
        long goalConsulting = toLongMap(fin, "goal_consulting", 30_000_000L);
        long goalOnline     = toLongMap(fin, "goal_online",     50_000_000L);
        long goalExport     = toLongMap(fin, "goal_export",     20_000_000L);

        // ── 현금 ────────────────────────────────────────────────────────────
        Long cashVal = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(balance::BIGINT), 0) FROM executive_cash_account WHERE company_id = ?",
                Long.class, companyId);
        long cash = cashVal == null ? 0L : cashVal;

        // ── 부채 ────────────────────────────────────────────────────────────
        Long debtVal = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(principal_balance::BIGINT), 0) FROM executive_debt WHERE company_id = ? AND status <> 'CLOSED'",
                Long.class, companyId);
        long totalDebt = debtVal == null ? 0L : debtVal;

        // ── 이번달 운영비용 ──────────────────────────────────────────────────
        Long fixedVal = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(amount::BIGINT), 0) FROM executive_operating_expense WHERE company_id = ? AND expense_month = ?",
                Long.class, companyId, monthStart);
        long fixedTotal = fixedVal == null ? 0L : fixedVal;

        List<Map<String, Object>> fixedBreakdown = jdbcTemplate.queryForList("""
                SELECT category, COALESCE(SUM(amount::BIGINT), 0) AS amount
                FROM executive_operating_expense
                WHERE company_id = ? AND expense_month = ?
                GROUP BY category ORDER BY SUM(amount) DESC
                """, companyId, monthStart);

        // ── 현금 생존일수 ────────────────────────────────────────────────────
        double dailyBurn = fixedTotal > 0 ? (double) fixedTotal / daysInMonth : 1.0;
        long cashDays = (long) (cash / dailyBurn);

        // ── 이번달 매출 + 페이스 ─────────────────────────────────────────────
        long onlineSales      = getMonthlyOnlineSales(companyId, monthStart, today);
        long exportSales      = getMonthlyExportSales(companyId, monthStart, today);
        long consultingSales  = getMonthlyConsultingSales(companyId, monthStart, today);
        long totalMonthlySales = onlineSales + exportSales + consultingSales;

        double paceRatio = (double) daysPassed / daysInMonth;
        long onlinePace     = (long) (goalOnline     * paceRatio);
        long exportPace     = (long) (goalExport     * paceRatio);
        long consultingPace = (long) (goalConsulting * paceRatio);

        // ── 전월 매출 ────────────────────────────────────────────────────────
        long prevOnline     = getMonthlyOnlineSales(companyId, prevMonthStart, prevMonthEnd);
        long prevExport     = getMonthlyExportSales(companyId, prevMonthStart, prevMonthEnd);
        long prevConsulting = getMonthlyConsultingSales(companyId, prevMonthStart, prevMonthEnd);
        long prevTotal      = prevOnline + prevExport + prevConsulting;

        // ── 이번주(7일) 현금 이벤트 ──────────────────────────────────────────
        LocalDate weekEnd = today.plusDays(7);
        List<Map<String, Object>> weekInflows = jdbcTemplate.queryForList("""
                SELECT flow_date, category, counterparty, amount::BIGINT AS amount, memo
                FROM executive_cash_flow
                WHERE company_id = ? AND flow_type = 'INFLOW' AND flow_date BETWEEN ? AND ?
                ORDER BY flow_date
                """, companyId, today, weekEnd);
        List<Map<String, Object>> weekOutflows = jdbcTemplate.queryForList("""
                SELECT flow_date, category, counterparty, amount::BIGINT AS amount, memo
                FROM executive_cash_flow
                WHERE company_id = ? AND flow_type = 'OUTFLOW' AND flow_date BETWEEN ? AND ?
                ORDER BY flow_date
                """, companyId, today, weekEnd);
        long weekNetCash = weekInflows.stream().mapToLong(r -> toLong(r, "amount")).sum()
                - weekOutflows.stream().mapToLong(r -> toLong(r, "amount")).sum();

        // ── 긴급 액션 1: 연체 미수금 ─────────────────────────────────────────
        List<Map<String, Object>> overdueReceivables = jdbcTemplate.queryForList("""
                SELECT partner_name,
                       (invoice_amount - paid_amount)::BIGINT AS outstanding,
                       due_date,
                       CURRENT_DATE - due_date AS overdue_days,
                       risk_level
                FROM executive_receivable
                WHERE company_id = ?
                  AND status IN ('OVERDUE', 'PARTIAL')
                  AND (invoice_amount - paid_amount) > 0
                ORDER BY CASE risk_level WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'WATCH' THEN 2 ELSE 3 END,
                         due_date
                """, companyId);

        // ── 긴급 액션 2: 재고 위험 ──────────────────────────────────────────
        List<Map<String, Object>> lowStockProducts = jdbcTemplate.queryForList("""
                SELECT product_name, stock_quantity, safe_stock, status
                FROM executive_product_profit
                WHERE company_id = ? AND stock_quantity <= safe_stock AND status <> 'DISCONTINUED'
                ORDER BY (stock_quantity * 1.0 / NULLIF(safe_stock, 1))
                """, companyId);

        // ── 긴급 액션 3: 5일 내 500만+ 출금 예정 ───────────────────────────
        LocalDate urgentWindow = today.plusDays(5);
        List<Map<String, Object>> bigPayments = jdbcTemplate.queryForList("""
                SELECT flow_date, category, counterparty, amount::BIGINT AS amount, memo
                FROM executive_cash_flow
                WHERE company_id = ? AND flow_type = 'OUTFLOW'
                  AND flow_date BETWEEN ? AND ?
                  AND amount >= 5000000
                ORDER BY flow_date
                """, companyId, today, urgentWindow);

        // ── 수출 파이프라인 다음 할 일 ───────────────────────────────────────
        List<Map<String, Object>> exportActions = jdbcTemplate.queryForList("""
                SELECT country, buyer_name, stage, next_action,
                       expected_payment_date, expected_sales::BIGINT AS expected_sales
                FROM executive_export_pipeline
                WHERE company_id = ? AND stage NOT IN ('완료', 'CLOSED')
                  AND next_action IS NOT NULL
                ORDER BY expected_payment_date NULLS LAST
                LIMIT 4
                """, companyId);

        // ── 결과 조립 ────────────────────────────────────────────────────────
        Map<String, Object> result = new LinkedHashMap<>();
        // 날짜 컨텍스트
        result.put("today", today.toString());
        result.put("daysPassed", daysPassed);
        result.put("daysInMonth", daysInMonth);
        // 생존 지표
        result.put("cash", cash);
        result.put("cashDays", cashDays);
        result.put("dailyBurn", (long) dailyBurn);
        result.put("totalDebt", totalDebt);
        result.put("fixedTotal", fixedTotal);
        result.put("fixedBreakdown", fixedBreakdown);
        // 이번달 매출 + 페이스
        result.put("onlineSales", onlineSales);
        result.put("exportSales", exportSales);
        result.put("consultingSales", consultingSales);
        result.put("totalMonthlySales", totalMonthlySales);
        result.put("goalOnline", goalOnline);
        result.put("goalExport", goalExport);
        result.put("goalConsulting", goalConsulting);
        result.put("onlinePaceTarget", onlinePace);
        result.put("exportPaceTarget", exportPace);
        result.put("consultingPaceTarget", consultingPace);
        result.put("paceRatio", Math.round(paceRatio * 1000.0) / 10.0); // %
        // 전월
        result.put("prevOnlineSales", prevOnline);
        result.put("prevExportSales", prevExport);
        result.put("prevConsultingSales", prevConsulting);
        result.put("prevTotalSales", prevTotal);
        // 이번주 현금
        result.put("weekInflows", weekInflows);
        result.put("weekOutflows", weekOutflows);
        result.put("weekNetCash", weekNetCash);
        // 긴급 액션
        result.put("overdueReceivables", overdueReceivables);
        result.put("lowStockProducts", lowStockProducts);
        result.put("bigPayments", bigPayments);
        result.put("exportActions", exportActions);
        return result;
    }

    private long getMonthlyOnlineSales(Long companyId, LocalDate start, LocalDate end) {
        Long val = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(d.net_revenue), 0)
                FROM daily_sales_stats d
                JOIN shop s ON s.id = d.shop_id
                WHERE d.company_id = ?
                  AND d.date BETWEEN ? AND ?
                  AND s.shop_code <> 'A000'
                  AND NOT (s.shop_name ILIKE '%해외%' OR s.shop_name ILIKE '%수출%'
                       OR s.shop_name ILIKE '%쇼피%' OR s.shop_name ILIKE '%아마존%')
                """, Long.class, companyId, start, end);
        return val == null ? 0L : val;
    }

    private long getMonthlyExportSales(Long companyId, LocalDate start, LocalDate end) {
        // daily_sales_stats 해외 채널 + executive_channel_performance OVERSEAS
        Long fromStats = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(d.net_revenue), 0)
                FROM daily_sales_stats d
                JOIN shop s ON s.id = d.shop_id
                WHERE d.company_id = ?
                  AND d.date BETWEEN ? AND ?
                  AND (s.shop_name ILIKE '%해외%' OR s.shop_name ILIKE '%수출%'
                    OR s.shop_name ILIKE '%쇼피%' OR s.shop_name ILIKE '%아마존%')
                """, Long.class, companyId, start, end);
        Long fromManual = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(sales_amount), 0)
                FROM executive_channel_performance
                WHERE company_id = ?
                  AND source_type IN ('OVERSEAS')
                  AND report_month BETWEEN ? AND ?
                """, Long.class, companyId, start, end);
        return (fromStats == null ? 0L : fromStats) + (fromManual == null ? 0L : fromManual);
    }

    private long getMonthlyConsultingSales(Long companyId, LocalDate start, LocalDate end) {
        Long val = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(contract_amount), 0)
                FROM executive_consulting_revenue
                WHERE company_id = ?
                  AND expected_payment_date BETWEEN ? AND ?
                """, Long.class, companyId, start, end);
        return val == null ? 0L : val;
    }

    private int computeHealthScore(long cash, long monthlySales, long netProfit, long totalDebt, double growthRate) {
        // 현금 (30점): 3억 이상 = 30점, 비례
        int cashScore = (int) Math.min(30, (cash / 300_000_000.0) * 30);
        // 매출 (30점): 월 1억 이상 = 30점
        int salesScore = (int) Math.min(30, (monthlySales / 100_000_000.0) * 30);
        // 순이익 (20점): 순이익 > 0 기준 비례
        int profitScore = netProfit > 0 ? (int) Math.min(20, (netProfit / 30_000_000.0) * 20) : 0;
        // 부채 (10점): 부채 0 = 10점, 부채 많을수록 감소
        int debtScore = totalDebt == 0 ? 10 : (int) Math.max(0, 10 - (totalDebt / 100_000_000.0) * 10);
        // 성장률 (10점): 10% 이상 = 10점
        int growthScore = (int) Math.min(10, Math.max(0, growthRate));
        return cashScore + salesScore + profitScore + debtScore + growthScore;
    }

    private String investmentGrade(int healthScore, long cash) {
        if (cash < 30_000_000L) return "RED";
        if (healthScore >= 80) return "BLUE";
        if (healthScore >= 60) return "GREEN";
        if (healthScore >= 40) return "YELLOW";
        return "RED";
    }

    private int computeStage(long online, long export, long consulting, long cash) {
        // 단계 조건 (월 매출 기준)
        if (online >= 50_000_000L && export >= 20_000_000L && consulting >= 30_000_000L && cash >= 100_000_000L)
            return 4; // HIGHFREE 플래그십 준비
        if (export >= 10_000_000L)
            return 3; // 수출 확대
        if (online >= 10_000_000L)
            return 2; // 단백깡 성장
        return 1;     // 컨설팅 중심
    }

    private List<Map<String, String>> buildWarnings(long cash, long fixedTotal, long monthlySales) {
        List<Map<String, String>> warnings = new ArrayList<>();
        if (cash < 30_000_000L) {
            warnings.add(Map.of("level", "RED", "message", "현금 3천만원 이하 — 즉각 현금 확보 필요"));
        } else if (cash >= 200_000_000L) {
            warnings.add(Map.of("level", "BLUE", "message", "현금 2억원 이상 — 공격적 투자 가능"));
        } else if (cash >= 100_000_000L) {
            warnings.add(Map.of("level", "GREEN", "message", "현금 1억원 이상 — 안정적 확장 가능"));
        }
        if (fixedTotal > 0 && monthlySales < fixedTotal) {
            warnings.add(Map.of("level", "YELLOW", "message", "매출이 고정비 미달 — 손익분기점 아래"));
        }
        return warnings;
    }

    private long toLong(Map<String, Object> map, String key) {
        Object v = map.get(key);
        if (v == null) return 0L;
        if (v instanceof Number n) return n.longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return 0L; }
    }

    private long toLongMap(Map<String, Object> map, String key) {
        return toLong(map, key);
    }

    private long toLongMap(Map<String, Object> map, String key, long defaultVal) {
        if (!map.containsKey(key) || map.get(key) == null) return defaultVal;
        return toLong(map, key);
    }

    // ─── 수익 구조 분석 ───────────────────────────────────────────────────────

    public Map<String, Object> getProfitManagement(Long companyId, LocalDate selectedPlanMonth) {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = selectedPlanMonth == null
                ? today.withDayOfMonth(1)
                : selectedPlanMonth.withDayOfMonth(1);
        LocalDate monthEnd = monthStart.withDayOfMonth(monthStart.lengthOfMonth());
        LocalDate actualEnd = monthStart.equals(today.withDayOfMonth(1)) ? today : monthEnd;
        LocalDate prevMonthStart = monthStart.minusMonths(1);

        // 1. 고정비 (운영 비용 - 이번 달)
        List<Map<String, Object>> fixedCosts = jdbcTemplate.queryForList("""
                WITH monthly_expense AS (
                    SELECT
                        category,
                        expense_type,
                        date_trunc('month', expense_month)::date AS expense_month,
                        SUM(amount) AS total
                    FROM executive_operating_expense
                    WHERE company_id = ?
                      AND expense_month <= ?
                    GROUP BY category, expense_type, date_trunc('month', expense_month)::date
                ),
                latest_fixed AS (
                    SELECT DISTINCT ON (category, expense_type)
                        category,
                        expense_type,
                        total,
                        expense_month,
                        CASE WHEN expense_month = ? THEN 'CURRENT' ELSE 'CARRIED_FORWARD' END AS source_basis
                    FROM monthly_expense
                    WHERE expense_type = 'FIXED'
                    ORDER BY category, expense_type, expense_month DESC
                ),
                current_variable AS (
                    SELECT
                        category,
                        expense_type,
                        total,
                        expense_month,
                        'CURRENT' AS source_basis
                    FROM monthly_expense
                    WHERE expense_type <> 'FIXED'
                      AND expense_month = ?
                )
                SELECT category, expense_type, total::BIGINT AS total, expense_month, source_basis
                FROM latest_fixed
                UNION ALL
                SELECT category, expense_type, total::BIGINT AS total, expense_month, source_basis
                FROM current_variable
                ORDER BY expense_type, category
                """, companyId, monthEnd, monthStart, monthStart);

        Long totalFixed = fixedCosts.stream()
                .mapToLong(row -> ((Number) row.getOrDefault("total", 0)).longValue())
                .sum();

        // 2. 부채 요약
        Map<String, Object> debtSummary = jdbcTemplate.queryForMap("""
                SELECT
                    COALESCE(SUM(principal_balance), 0)::BIGINT AS total_balance,
                    CASE WHEN SUM(principal_balance) > 0
                         THEN (SUM(principal_balance * interest_rate) / SUM(principal_balance))
                         ELSE 0 END AS avg_interest_rate,
                    COALESCE(SUM(monthly_payment), 0)::BIGINT AS total_monthly_payment
                FROM executive_debt
                WHERE company_id = ? AND status <> 'CLOSED'
                """, companyId);

        // 3. 제품 목록 (원가 자동 채우기용)
        List<Map<String, Object>> products = jdbcTemplate.queryForList("""
                WITH cost_channel AS (
                    SELECT
                        pcc.id,
                        pcc.channel_name,
                        pcc.product_code,
                        pcc.product_name,
                        pcc.sku_code,
                        GREATEST(COALESCE(pcc.qty_per_unit, 1), 1) AS qty_per_unit,
                        COALESCE(NULLIF(pcc.consumer_price, 0), pcc.list_price, 0) AS sale_price,
                        COALESCE(NULLIF(pcc.production_cost, 0), psm.production_cost * GREATEST(COALESCE(pcc.qty_per_unit, 1), 1), 0) AS cogs,
                        COALESCE(pcc.channel_fee_rate, 0) AS channel_fee_rate,
                        COALESCE(pcc.marketing_rate, 0) AS marketing_rate,
                        COALESCE(pcc.ad_rate, 0) AS ad_rate,
                        COALESCE(pcc.opex_rate, 0) AS opex_rate,
                        COALESCE(pcc.consumer_ship_fee, 0) AS consumer_ship_fee,
                        COALESCE(pcc.storage_fee_unit, 0) AS storage_fee_unit,
                        COALESCE(psm.weight_g, 0) AS weight_g,
                        COALESCE(psm.temp_type, '상온') AS temp_type,
                        COALESCE(sales.sold_qty, 0) AS sold_qty,
                        COALESCE(sales.sold_amount, 0) AS sold_amount
                    FROM product_cost_channel pcc
                    LEFT JOIN product_sku_master psm
                      ON psm.company_id = pcc.company_id
                     AND psm.sku_code = pcc.sku_code
                    LEFT JOIN LATERAL (
                        SELECT
                            COALESCE(SUM(o.order_quantity), 0)::BIGINT AS sold_qty,
                            COALESCE(SUM(o.pay_amt), 0)::BIGINT AS sold_amount
                        FROM orders o
                        JOIN shop s ON s.id = o.shop_id
                        LEFT JOIN product op ON op.id = o.product_id
                        WHERE o.company_id = pcc.company_id
                          AND (o.ord_time AT TIME ZONE 'Asia/Seoul')::date BETWEEN ? AND ?
                          AND COALESCE(o.ord_status, '') NOT IN ('취소완료', '반품완료', '교환완료', '맞교환완료', '주문취소', 'CANCELLED')
                          AND (
                              s.shop_name = pcc.channel_name
                              OR (pcc.channel_name = '스마트스토어팜' AND s.shop_name ILIKE '%스마트스토어%')
                              OR (pcc.channel_name = '자사몰' AND s.shop_name ILIKE '%아임웹%')
                              OR (pcc.channel_name = '카카오톡스토어' AND s.shop_name ILIKE '%카카오%')
                          )
                          AND (
                              op.product_name ILIKE CONCAT('%', pcc.product_name, '%')
                              OR (
                                  pcc.product_name ILIKE '%당근효소%'
                                  AND op.product_name ILIKE '%당근효소%'
                                  AND (
                                      (pcc.product_name ILIKE '%1박스%' AND op.product_name ILIKE '%1박스%')
                                      OR (pcc.product_name ILIKE '%2박스%' AND op.product_name ILIKE '%2박스%')
                                      OR (pcc.product_name ILIKE '%3박스%' AND op.product_name ILIKE '%3박스%')
                                      OR (pcc.product_name ILIKE '%5박스%' AND op.product_name ILIKE '%5박스%')
                                      OR (pcc.product_name ILIKE '%7박스%' AND op.product_name ILIKE '%7박스%')
                                      OR (pcc.product_name ILIKE '%10박스%' AND op.product_name ILIKE '%10박스%')
                                      OR (pcc.product_name ILIKE '%13박스%' AND op.product_name ILIKE '%13박스%')
                                  )
                              )
                              OR (pcc.product_name ILIKE '%블랙페퍼%' AND op.product_name ILIKE '%블랙페퍼%')
                              OR (pcc.product_name ILIKE '%매콤양념%' AND op.product_name ILIKE '%매콤%')
                              OR (pcc.product_name ILIKE '%오리지널%' AND op.product_name ILIKE '%오리지널%')
                              OR (pcc.product_name ILIKE '%큐브%' AND op.product_name ILIKE '%큐브%')
                              OR (pcc.product_name ILIKE '%혼합%' AND (op.product_name ILIKE '%혼합%' OR op.product_name ILIKE '%SET%'))
                              OR (pcc.product_name ILIKE '%갈릭새우깡%' AND op.product_name ILIKE '%갈릭%')
                              OR (pcc.product_name ILIKE '%알싸고추깡%' AND op.product_name ILIKE '%알싸%')
                              OR (pcc.product_name ILIKE '%야채포테이토%' AND op.product_name ILIKE '%야채%')
                              OR (pcc.product_name ILIKE '%등심돈까스%' AND op.product_name ILIKE '%등심%')
                              OR (pcc.product_name ILIKE '%왕돈까스%' AND op.product_name ILIKE '%왕돈까스%')
                              OR (pcc.product_name ILIKE '%치즈돈까스%' AND op.product_name ILIKE '%치즈%')
                          )
                          AND (
                              (
                                  op.product_name NOT ILIKE '%1박스%'
                                  AND op.product_name NOT ILIKE '%2박스%'
                                  AND op.product_name NOT ILIKE '%3박스%'
                                  AND op.product_name NOT ILIKE '%5박스%'
                                  AND op.product_name NOT ILIKE '%7박스%'
                                  AND op.product_name NOT ILIKE '%10박스%'
                                  AND op.product_name NOT ILIKE '%13박스%'
                                  AND op.product_name NOT ILIKE '%1개%'
                                  AND op.product_name NOT ILIKE '%4개%'
                                  AND op.product_name NOT ILIKE '%10개%'
                                  AND op.product_name NOT ILIKE '%20개%'
                                  AND op.product_name NOT ILIKE '%30개%'
                                  AND op.product_name NOT ILIKE '%40개%'
                                  AND op.product_name NOT ILIKE '%10팩%'
                                  AND op.product_name NOT ILIKE '%16팩%'
                                  AND op.product_name NOT ILIKE '%20팩%'
                                  AND op.product_name NOT ILIKE '%30팩%'
                              )
                              OR (op.product_name ILIKE '%1박스%' AND pcc.qty_per_unit = 1)
                              OR (op.product_name ILIKE '%2박스%' AND pcc.qty_per_unit = 2)
                              OR (op.product_name ILIKE '%3박스%' AND pcc.qty_per_unit = 3)
                              OR (op.product_name ILIKE '%5박스%' AND pcc.qty_per_unit = 5)
                              OR (op.product_name ILIKE '%7박스%' AND pcc.qty_per_unit IN (7, 8))
                              OR (op.product_name ILIKE '%10박스%' AND pcc.qty_per_unit = 10)
                              OR (op.product_name ILIKE '%13박스%' AND pcc.qty_per_unit IN (13, 15))
                              OR (op.product_name ILIKE '%1개%' AND pcc.qty_per_unit = 1)
                              OR (op.product_name ILIKE '%4개%' AND pcc.qty_per_unit = 4)
                              OR (op.product_name ILIKE '%10개%' AND pcc.qty_per_unit = 10)
                              OR (op.product_name ILIKE '%20개%' AND pcc.qty_per_unit = 20)
                              OR (op.product_name ILIKE '%30개%' AND pcc.qty_per_unit = 30)
                              OR (op.product_name ILIKE '%40개%' AND pcc.qty_per_unit = 40)
                              OR (op.product_name ILIKE '%10팩%' AND pcc.qty_per_unit = 10)
                              OR (op.product_name ILIKE '%16팩%' AND pcc.qty_per_unit = 16)
                              OR (op.product_name ILIKE '%20팩%' AND pcc.qty_per_unit = 20)
                              OR (op.product_name ILIKE '%30팩%' AND pcc.qty_per_unit = 30)
                          )
                    ) sales ON TRUE
                    WHERE pcc.company_id = ?
                      AND pcc.is_active = TRUE
                      AND pcc.channel_name NOT ILIKE '%해외%'
                      AND pcc.channel_name NOT ILIKE '%오프라인%'
                ),
                logistics AS (
                    SELECT
                        cc.*,
                        COALESCE((
                            SELECT lfc.fee
                            FROM logistics_fee_config lfc
                            WHERE lfc.company_id = ?
                              AND lfc.temp_type = cc.temp_type
                              AND cc.weight_g <= lfc.weight_limit_g
                            ORDER BY lfc.weight_limit_g
                            LIMIT 1
                        ), (
                            SELECT lfc.fee
                            FROM logistics_fee_config lfc
                            WHERE lfc.company_id = ?
                              AND lfc.temp_type = '상온'
                            ORDER BY lfc.weight_limit_g
                            LIMIT 1
                        ), 0) AS base_logistics_fee
                    FROM cost_channel cc
                )
                SELECT
                    id,
                    product_name,
                    sku_code AS sku,
                    channel_name,
                    product_code,
                    qty_per_unit,
                    sold_qty,
                    sold_amount,
                    CEIL(sold_qty * (?::NUMERIC / GREATEST(?::NUMERIC, 1)))::BIGINT AS target_qty,
                    ROUND(cogs, 0)::BIGINT AS cogs,
                    ROUND(sale_price, 0)::BIGINT AS sale_price,
                    ROUND(sale_price * channel_fee_rate, 0)::BIGINT AS platform_fee,
                    ROUND(sale_price * ad_rate, 0)::BIGINT AS ad_cost,
                    ROUND(GREATEST(base_logistics_fee - consumer_ship_fee, 0) + (storage_fee_unit * qty_per_unit), 0)::BIGINT AS logistics_cost,
                    ROUND(sale_price * marketing_rate, 0)::BIGINT AS marketing_cost,
                    ROUND(sale_price * opex_rate, 0)::BIGINT AS operating_admin_cost,
                    'product_cost_channel' AS source
                FROM logistics
                UNION ALL
                SELECT
                    id,
                    product_name,
                    sku,
                    NULL AS channel_name,
                    NULL AS product_code,
                    1 AS qty_per_unit,
                    0::BIGINT AS sold_qty,
                    0::BIGINT AS sold_amount,
                    0::BIGINT AS target_qty,
                    production_cost::BIGINT AS cogs,
                    selling_price::BIGINT AS sale_price,
                    platform_fee::BIGINT AS platform_fee,
                    ad_cost::BIGINT AS ad_cost,
                    logistics_cost::BIGINT AS logistics_cost,
                    marketing_cost::BIGINT AS marketing_cost,
                    0::BIGINT AS operating_admin_cost,
                    'executive_product_profit' AS source
                FROM executive_product_profit
                WHERE company_id = ?
                  AND NOT EXISTS (
                      SELECT 1
                      FROM product_cost_channel pcc
                      WHERE pcc.company_id = ?
                        AND pcc.is_active = TRUE
                        AND pcc.channel_name NOT ILIKE '%해외%'
                        AND pcc.channel_name NOT ILIKE '%오프라인%'
                  )
                ORDER BY product_name
                """, monthStart, actualEnd, companyId, companyId, companyId,
                monthStart.lengthOfMonth(),
                monthStart.equals(today.withDayOfMonth(1)) ? today.getDayOfMonth() : monthStart.lengthOfMonth(),
                companyId, companyId);

        // 4. 저장된 계획 (이번 달)
        List<Map<String, Object>> plan = jdbcTemplate.queryForList("""
                SELECT id, channel, product_name,
                       sale_price::BIGINT, cogs::BIGINT,
                       logistics_cost::BIGINT, marketing_cost::BIGINT,
                       other_cost::BIGINT, planned_qty
                FROM executive_profit_plan
                WHERE company_id = ? AND plan_month = ?
                ORDER BY channel, id
                """, companyId, monthStart);

        List<Map<String, Object>> previousPlan = jdbcTemplate.queryForList("""
                SELECT id, channel, product_name,
                       sale_price::BIGINT, cogs::BIGINT,
                       logistics_cost::BIGINT, marketing_cost::BIGINT,
                       other_cost::BIGINT, planned_qty
                FROM executive_profit_plan
                WHERE company_id = ? AND plan_month = ?
                ORDER BY channel, id
                """, companyId, prevMonthStart);

        // 실시간 매출 화면과 동일 기준: 오프라인 = shop_code 'OFF-%' (발주시트), 온라인 = 그 외
        Long ordersOnline = queryLong("""
                SELECT COALESCE(SUM(o.pay_amt), 0)::BIGINT
                FROM orders o
                JOIN shop s ON s.id = o.shop_id
                WHERE o.company_id = ?
                  AND (o.ord_time AT TIME ZONE 'Asia/Seoul')::date BETWEEN ? AND ?
                  AND s.shop_code <> 'A000'
                  AND s.shop_code NOT LIKE 'OFF-%'
                  AND NOT (s.shop_name ILIKE '%수출%' OR s.shop_name ILIKE '%해외%'
                       OR s.shop_name ILIKE '%오프라인%' OR s.shop_name ILIKE '%매장%')
                  AND COALESCE(o.ord_status, '') NOT IN ('취소완료', '반품완료', '교환완료', '맞교환완료', '주문취소', 'CANCELLED')
                """, companyId, monthStart, monthEnd);

        Long ordersOffline = queryLong("""
                SELECT COALESCE(SUM(o.pay_amt), 0)::BIGINT
                FROM orders o
                JOIN shop s ON s.id = o.shop_id
                WHERE o.company_id = ?
                  AND (o.ord_time AT TIME ZONE 'Asia/Seoul')::date BETWEEN ? AND ?
                  AND (s.shop_code LIKE 'OFF-%' OR s.shop_name ILIKE '%오프라인%' OR s.shop_name ILIKE '%매장%')
                  AND COALESCE(o.ord_status, '') NOT IN ('취소완료', '반품완료', '교환완료', '맞교환완료', '주문취소', 'CANCELLED')
                """, companyId, monthStart, monthEnd);

        Long dailyStatsOnline = queryLong("""
                SELECT COALESCE(SUM(d.net_revenue), 0)::BIGINT
                FROM daily_sales_stats d
                JOIN shop s ON s.id = d.shop_id
                WHERE d.company_id = ?
                  AND d.date BETWEEN ? AND ?
                  AND s.shop_code <> 'A000'
                  AND NOT (s.shop_name ILIKE '%수출%' OR s.shop_name ILIKE '%해외%'
                       OR s.shop_name ILIKE '%오프라인%' OR s.shop_name ILIKE '%매장%')
                """, companyId, monthStart, monthEnd);

        Long playAutoChannelOnline = queryLong("""
                SELECT COALESCE(SUM(sales_amount), 0)::BIGINT
                FROM executive_channel_performance
                WHERE company_id = ?
                  AND report_month BETWEEN ? AND ?
                  AND source_type = 'PLAYAUTO'
                  AND NOT (channel_name ILIKE '%수출%' OR channel_name ILIKE '%해외%'
                       OR channel_name ILIKE '%오프라인%' OR channel_name ILIKE '%매장%')
                """, companyId, monthStart, monthEnd);

        Long manualOnline = queryLong("""
                SELECT COALESCE(SUM(sales_amount), 0)::BIGINT
                FROM executive_channel_performance
                WHERE company_id = ?
                  AND report_month BETWEEN ? AND ?
                  AND COALESCE(source_type, 'MANUAL') NOT IN ('PLAYAUTO', 'DIRECT_API')
                  AND NOT (COALESCE(source_type, 'MANUAL') IN ('OFFLINE', 'OVERSEAS', 'EXPORT')
                       OR channel_name ILIKE '%수출%' OR channel_name ILIKE '%해외%'
                       OR channel_name ILIKE '%오프라인%' OR channel_name ILIKE '%매장%')
                """, companyId, monthStart, monthEnd);

        Long actualOnline = (ordersOnline != null && ordersOnline > 0L)
                ? ordersOnline + manualOnline
                : Math.max(dailyStatsOnline, playAutoChannelOnline) + manualOnline;

        Long actualConsulting = queryLong("""
                SELECT COALESCE(SUM(paid_amount), 0)::BIGINT
                FROM executive_consulting_revenue
                WHERE company_id = ?
                  AND expected_payment_date BETWEEN ? AND ?
                  AND COALESCE(status, '') NOT IN ('CANCELLED', '취소', '취소완료')
                """, companyId, monthStart, monthEnd);

        Long pipelineExport = queryLong("""
                SELECT COALESCE(SUM(expected_sales), 0)::BIGINT
                FROM executive_export_pipeline
                WHERE company_id = ?
                  AND expected_payment_date BETWEEN ? AND ?
                  AND COALESCE(stage, '') NOT IN ('CANCELLED', 'LOST', '취소', '실패', '보류')
                """, companyId, monthStart, monthEnd);

        Long actualExport = queryLong("""
                SELECT COALESCE(SUM(sales_amount), 0)::BIGINT
                FROM executive_channel_performance
                WHERE company_id = ?
                  AND report_month BETWEEN ? AND ?
                  AND COALESCE(source_type, 'MANUAL') NOT IN ('PLAYAUTO', 'DIRECT_API')
                  AND (
                      COALESCE(source_type, 'MANUAL') IN ('OVERSEAS', 'EXPORT')
                      OR channel_name ILIKE '%수출%'
                      OR channel_name ILIKE '%해외%'
                  )
                """, companyId, monthStart, monthEnd);

        Long manualOffline = queryLong("""
                SELECT COALESCE(SUM(sales_amount), 0)::BIGINT
                FROM executive_channel_performance
                WHERE company_id = ?
                  AND report_month BETWEEN ? AND ?
                  AND COALESCE(source_type, 'MANUAL') NOT IN ('PLAYAUTO', 'DIRECT_API')
                  AND (
                      COALESCE(source_type, 'MANUAL') = 'OFFLINE'
                      OR channel_name ILIKE '%오프라인%'
                      OR channel_name ILIKE '%매장%'
                  )
                """, companyId, monthStart, monthEnd);

        Long actualOffline = (ordersOffline == null ? 0L : ordersOffline)
                + (manualOffline == null ? 0L : manualOffline);

        Long confirmedCashInflow = queryLong("""
                SELECT COALESCE(SUM(amount), 0)::BIGINT
                FROM executive_cash_flow
                WHERE company_id = ?
                  AND flow_type = 'INFLOW'
                  AND flow_date BETWEEN ? AND ?
                  AND COALESCE(status, '') IN ('DONE', 'PAID', 'RECEIVED', 'COMPLETED', '입금완료', '완료')
                """, companyId, monthStart, monthEnd);

        Long scheduledCashInflow = queryLong("""
                SELECT COALESCE(SUM(amount), 0)::BIGINT
                FROM executive_cash_flow
                WHERE company_id = ?
                  AND flow_type = 'INFLOW'
                  AND flow_date BETWEEN ? AND ?
                  AND COALESCE(status, '') NOT IN ('DONE', 'PAID', 'RECEIVED', 'COMPLETED', '입금완료', '완료')
                """, companyId, monthStart, monthEnd);

        List<Map<String, Object>> salesSources = new ArrayList<>();
        salesSources.add(salesSource("orders", "PlayAuto 주문 원장", ordersOnline, "actual", "국내 온라인 기준값"));
        salesSources.add(salesSource("daily_sales_stats", "일별 매출 통계", dailyStatsOnline, "reference", "주문 원장 재집계값, 중복 방지로 합산 제외"));
        salesSources.add(salesSource("channel_playauto", "채널 실적 PlayAuto", playAutoChannelOnline, "reference", "채널별 표시용, 주문 원장과 중복"));
        salesSources.add(salesSource("channel_manual_online", "수동 온라인 실적", manualOnline, "actual", "주문 원장에 없는 수동 온라인 보강"));
        salesSources.add(salesSource("orders_offline", "오프라인 주문 원장(발주시트)", ordersOffline, "actual", "발주시트·정산시트 오프라인 실시간"));
        salesSources.add(salesSource("channel_manual_offline", "수동 오프라인 실적", manualOffline, "actual", "주문 원장에 없는 수동 보강"));
        salesSources.add(salesSource("channel_manual_export", "확정 수출 실적", actualExport, "actual", "수동 입력된 확정 수출/해외 매출"));
        salesSources.add(salesSource("consulting_paid", "컨설팅 입금", actualConsulting, "actual", "paid_amount 기준"));
        salesSources.add(salesSource("cash_flow_confirmed", "확정 입금 현금흐름", confirmedCashInflow, "reference", "전표 중복 가능성으로 별도 표시"));
        salesSources.add(salesSource("cash_flow_scheduled", "예정 입금 현금흐름", scheduledCashInflow, "expected", "아직 확정 매출 아님"));
        salesSources.add(salesSource("export_pipeline", "수출 파이프라인 예상액", pipelineExport, "expected", "예상 매출, 실제 총매출에서 제외"));

        Map<String, Long> actualSales = new HashMap<>();
        actualSales.put("online", actualOnline == null ? 0L : actualOnline);
        actualSales.put("offline", actualOffline == null ? 0L : actualOffline);
        actualSales.put("export", actualExport == null ? 0L : actualExport);
        actualSales.put("consulting", actualConsulting == null ? 0L : actualConsulting);
        actualSales.put("expectedExport", pipelineExport == null ? 0L : pipelineExport);
        actualSales.put("confirmedCashInflow", confirmedCashInflow == null ? 0L : confirmedCashInflow);
        actualSales.put("scheduledCashInflow", scheduledCashInflow == null ? 0L : scheduledCashInflow);
        actualSales.put("total",
                (actualOnline == null ? 0L : actualOnline)
                        + (actualOffline == null ? 0L : actualOffline)
                        + (actualExport == null ? 0L : actualExport)
                        + (actualConsulting == null ? 0L : actualConsulting));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("planMonth", monthStart.toString());
        result.put("fixedCosts", fixedCosts);
        result.put("totalFixedCost", totalFixed == null ? 0L : totalFixed);
        result.put("debtSummary", debtSummary);
        result.put("products", products);
        result.put("plan", plan);
        result.put("previousPlan", previousPlan);
        result.put("actualSales", actualSales);
        result.put("salesSources", salesSources);
        return result;
    }

    private Long queryLong(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0L : value;
    }

    private Map<String, Object> salesSource(String key, String label, Long amount, String usage, String note) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("key", key);
        row.put("label", label);
        row.put("amount", amount == null ? 0L : amount);
        row.put("usage", usage);
        row.put("note", note);
        return row;
    }

    public void saveProfitPlan(Long companyId, LocalDate planMonth, List<Map<String, Object>> items) {
        // 해당 월 기존 계획 전체 삭제 후 재삽입
        jdbcTemplate.update("""
                DELETE FROM executive_profit_plan WHERE company_id = ? AND plan_month = ?
                """, companyId, planMonth);

        for (Map<String, Object> item : items) {
            jdbcTemplate.update("""
                    INSERT INTO executive_profit_plan
                        (company_id, plan_month, channel, product_name,
                         sale_price, cogs, logistics_cost, marketing_cost, other_cost, planned_qty)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    companyId,
                    planMonth,
                    item.get("channel"),
                    item.get("product_name"),
                    toDecimal(item.get("sale_price")),
                    toDecimal(item.get("cogs")),
                    toDecimal(item.get("logistics_cost")),
                    toDecimal(item.get("marketing_cost")),
                    toDecimal(item.get("other_cost")),
                    toInt(item.get("planned_qty"))
            );
        }
    }

    private java.math.BigDecimal toDecimal(Object v) {
        if (v == null) return java.math.BigDecimal.ZERO;
        if (v instanceof java.math.BigDecimal bd) return bd;
        try { return new java.math.BigDecimal(v.toString()); } catch (Exception e) { return java.math.BigDecimal.ZERO; }
    }

    private int toInt(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.intValue();
        try { return Integer.parseInt(v.toString()); } catch (Exception e) { return 0; }
    }

    // ── 브랜드 사업 현황 ────────────────────────────────────────────────────

    public Map<String, Object> getBrandHealth(Long companyId, Long brandId, LocalDate startDate, LocalDate endDate) {
        LocalDate resolvedEnd   = endDate   != null ? endDate   : LocalDate.now();
        LocalDate resolvedStart = startDate != null ? startDate : resolvedEnd.withDayOfMonth(1);

        // 1. 브랜드 목록
        List<Map<String, Object>> brands = jdbcTemplate.queryForList("""
                SELECT id, brand_name
                FROM brand
                WHERE company_id = ?
                ORDER BY brand_name
                """, companyId);

        // 2. 월별 매출 트렌드 (최근 6개월)
        LocalDate trendStart = resolvedEnd.withDayOfMonth(1).minusMonths(5);
        List<Map<String, Object>> monthlySales = jdbcTemplate.queryForList("""
                SELECT
                    date_trunc('month', o.ord_time::date)::date AS month,
                    b.brand_name,
                    ROUND(COALESCE(SUM(o.pay_amt), 0), 0)         AS sales_amount,
                    COUNT(*)::int                                  AS order_count,
                    ROUND(COALESCE(SUM(o.pay_amt), 0) * 0.40, 0) AS estimated_profit
                FROM orders o
                JOIN brand b ON b.id = o.brand_id
                WHERE o.company_id = ?
                  AND o.ord_time::date >= ?
                  AND o.ord_status NOT IN ('취소완료','반품완료','교환완료','맞교환완료','주문취소')
                  AND (?::bigint IS NULL OR o.brand_id = ?::bigint)
                GROUP BY date_trunc('month', o.ord_time::date)::date, b.brand_name
                ORDER BY month, b.brand_name
                """, companyId, trendStart, brandId, brandId);

        // 3. 채널별 매출 집계 (조회 기간)
        List<Map<String, Object>> channelBreakdown = jdbcTemplate.queryForList("""
                SELECT
                    s.shop_name                                     AS channel_name,
                    ROUND(COALESCE(SUM(o.pay_amt), 0), 0)          AS sales_amount,
                    COUNT(*)::int                                   AS order_count,
                    ROUND(COALESCE(SUM(o.pay_amt), 0) * 0.40, 0)  AS estimated_profit
                FROM orders o
                JOIN shop s ON s.id = o.shop_id
                WHERE o.company_id = ?
                  AND o.ord_time::date BETWEEN ? AND ?
                  AND s.shop_code <> 'A000'
                  AND o.ord_status NOT IN ('취소완료','반품완료','교환완료','맞교환완료','주문취소')
                  AND (?::bigint IS NULL OR o.brand_id = ?::bigint)
                GROUP BY s.shop_name
                HAVING COALESCE(SUM(o.pay_amt), 0) > 0
                ORDER BY sales_amount DESC
                """, companyId, resolvedStart, resolvedEnd, brandId, brandId);

        // 4. SKU 재고 현황 (소진 예상일, 회전율 포함)
        List<Map<String, Object>> inventory = jdbcTemplate.queryForList("""
                WITH recent_out AS (
                    SELECT product_id, COALESCE(SUM(outbound_count), 0) AS cnt_7d
                    FROM product_outbound
                    WHERE company_id = ? AND outbound_date >= CURRENT_DATE - INTERVAL '6 day'
                    GROUP BY product_id
                ),
                monthly_out AS (
                    SELECT product_id, COALESCE(SUM(outbound_count), 0) AS cnt_30d
                    FROM product_outbound
                    WHERE company_id = ? AND outbound_date >= CURRENT_DATE - INTERVAL '29 day'
                    GROUP BY product_id
                )
                SELECT
                    p.id,
                    p.product_name,
                    p.sku_cd,
                    b.brand_name,
                    p.real_stock,
                    p.safe_stock,
                    cost.production_cost,
                    ROUND(cost.production_cost * p.real_stock, 0) AS inventory_value,
                    COALESCE(r.cnt_7d,  0)::int AS last_7d_outbound,
                    COALESCE(m.cnt_30d, 0)::int AS last_30d_outbound,
                    CASE WHEN COALESCE(r.cnt_7d, 0) = 0 THEN NULL
                         ELSE ROUND(p.real_stock::numeric / (COALESCE(r.cnt_7d,0)::numeric / 7), 0)
                    END AS days_to_depletion,
                    CASE WHEN p.real_stock <= 0 THEN NULL
                         ELSE ROUND(COALESCE(m.cnt_30d,0)::numeric / NULLIF(p.real_stock,0), 2)
                    END AS turnover_rate,
                    CASE
                        WHEN p.real_stock <= 0 THEN 'OUT_OF_STOCK'
                        WHEN p.real_stock <= GREATEST(COALESCE(NULLIF(p.safe_stock,0),1),1) THEN 'LOW_STOCK'
                        WHEN COALESCE(r.cnt_7d,0) = 0 THEN 'NO_MOVEMENT'
                        ELSE 'NORMAL'
                    END AS stock_status
                FROM product p
                JOIN product_sku_master cost
                  ON cost.company_id = p.company_id
                 AND cost.sku_code = p.sku_cd
                LEFT JOIN brand b ON b.id = p.brand_id
                LEFT JOIN recent_out  r ON r.product_id = p.id
                LEFT JOIN monthly_out m ON m.product_id = p.id
                WHERE p.company_id = ?
                  AND (?::bigint IS NULL OR p.brand_id = ?::bigint)
                ORDER BY
                    CASE WHEN p.real_stock <= 0 THEN 1
                         WHEN p.real_stock <= GREATEST(COALESCE(NULLIF(p.safe_stock,0),1),1) THEN 2
                         WHEN COALESCE(r.cnt_7d,0) = 0 THEN 3
                         ELSE 4 END,
                    COALESCE(m.cnt_30d,0) DESC, p.product_name
                """, companyId, companyId, companyId, brandId, brandId);

        // 5. 요약 KPI (조회 기간)
        long totalSales  = channelBreakdown.stream()
                .mapToLong(r -> ((Number) r.getOrDefault("sales_amount", 0)).longValue()).sum();
        long totalProfit = channelBreakdown.stream()
                .mapToLong(r -> ((Number) r.getOrDefault("estimated_profit", 0)).longValue()).sum();
        double avgMargin = totalSales > 0 ? Math.round(totalProfit * 100.0 / totalSales * 10) / 10.0 : 0.0;

        long totalStock = inventory.stream()
                .mapToLong(r -> ((Number) r.getOrDefault("real_stock", 0)).longValue()).sum();
        long out7d = inventory.stream()
                .mapToLong(r -> ((Number) r.getOrDefault("last_7d_outbound", 0)).longValue()).sum();
        long out30d = inventory.stream()
                .mapToLong(r -> ((Number) r.getOrDefault("last_30d_outbound", 0)).longValue()).sum();
        double avgDaysToDepletion = out7d > 0 ? Math.round(totalStock * 7.0 / out7d * 10) / 10.0 : 0.0;
        double inventoryTurnoverRate = totalStock > 0
                ? Math.round(out30d * 10.0 / totalStock) / 10.0
                : 0.0;
        long totalInventoryValue = inventory.stream()
                .mapToLong(r -> ((Number) r.getOrDefault("inventory_value", 0)).longValue()).sum();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total_sales",           totalSales);
        summary.put("total_profit",          totalProfit);
        summary.put("avg_margin",            avgMargin);
        summary.put("total_stock",           totalStock);
        summary.put("total_inventory_value", totalInventoryValue);
        summary.put("inventory_turnover_rate", inventoryTurnoverRate);
        summary.put("avg_days_to_depletion", avgDaysToDepletion);
        summary.put("period_start",          resolvedStart.toString());
        summary.put("period_end",            resolvedEnd.toString());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("brands",           brands);
        result.put("monthlySales",     monthlySales);
        result.put("channelBreakdown", channelBreakdown);
        result.put("inventory",        inventory);
        result.put("summary",          summary);
        return result;
    }

    /** 임시 진단 API: 쿠팡 주문 pay_amt 실제 값 확인용 */
    public Map<String, Object> diagnoseChannelOrders(Long companyId, LocalDate startDate, LocalDate endDate, String shopNameFilter) {
        LocalDate s = startDate != null ? startDate : LocalDate.now().withDayOfMonth(1);
        LocalDate e = endDate != null ? endDate : LocalDate.now();

        // daily_sales_stats 기준 집계
        List<Map<String, Object>> statsSummary = jdbcTemplate.queryForList("""
                SELECT
                    s.shop_name,
                    s.shop_code,
                    COUNT(DISTINCT d.id) AS stat_rows,
                    SUM(d.orderer_count) AS total_orders,
                    SUM(d.net_revenue) AS total_net_revenue,
                    MIN(d.date) AS min_date,
                    MAX(d.date) AS max_date
                FROM daily_sales_stats d
                JOIN shop s ON s.id = d.shop_id
                WHERE d.company_id = ?
                  AND d.date BETWEEN ? AND ?
                  AND (? IS NULL OR s.shop_name ILIKE CONCAT('%', ?::text, '%'))
                GROUP BY s.shop_name, s.shop_code
                ORDER BY total_net_revenue DESC
                """, companyId, s, e, shopNameFilter, shopNameFilter);

        // orders 테이블 기준 집계 (raw 데이터)
        List<Map<String, Object>> ordersSummary = jdbcTemplate.queryForList("""
                SELECT
                    s.shop_name,
                    s.shop_code,
                    COUNT(o.uniq) AS total_orders,
                    SUM(o.pay_amt) AS total_pay_amt,
                    SUM(o.discount_amt) AS total_discount_amt,
                    SUM(o.shipping_fee) AS total_ship_cost,
                    ROUND(AVG(o.pay_amt), 0) AS avg_pay_amt,
                    o.ord_status,
                    MIN(o.ord_time) AS min_ord_time,
                    MAX(o.ord_time) AS max_ord_time
                FROM orders o
                JOIN shop s ON s.id = o.shop_id
                WHERE o.company_id = ?
                  AND COALESCE(o.ord_time, o.wdate) BETWEEN ?::timestamp AND ?::timestamp + INTERVAL '1 day'
                  AND (? IS NULL OR s.shop_name ILIKE CONCAT('%', ?::text, '%'))
                GROUP BY s.shop_name, s.shop_code, o.ord_status
                ORDER BY total_pay_amt DESC NULLS LAST
                """, companyId, s, e, shopNameFilter, shopNameFilter);

        // orders 중 brand_id/product_id null로 stats에서 누락된 건수
        List<Map<String, Object>> unmappedOrders = jdbcTemplate.queryForList("""
                SELECT
                    s.shop_name,
                    COUNT(o.uniq) AS unmapped_count,
                    SUM(o.pay_amt) AS unmapped_pay_amt,
                    COUNT(o.uniq) FILTER (WHERE o.brand_id IS NULL) AS null_brand,
                    COUNT(o.uniq) FILTER (WHERE o.product_id IS NULL) AS null_product
                FROM orders o
                JOIN shop s ON s.id = o.shop_id
                WHERE o.company_id = ?
                  AND COALESCE(o.ord_time, o.wdate) BETWEEN ?::timestamp AND ?::timestamp + INTERVAL '1 day'
                  AND (o.brand_id IS NULL OR o.product_id IS NULL)
                  AND (? IS NULL OR s.shop_name ILIKE CONCAT('%', ?::text, '%'))
                GROUP BY s.shop_name
                """, companyId, s, e, shopNameFilter, shopNameFilter);

        return Map.of(
                "period", Map.of("start", s, "end", e),
                "statsSummary", statsSummary,
                "ordersSummary", ordersSummary,
                "unmappedOrders", unmappedOrders
        );
    }

    // ── 채널별·제품별 판매 상세 분석 API ─────────────────────────────────────

    public List<Map<String, Object>> getSalesDetail(Long companyId, LocalDate startDate, LocalDate endDate, String channel, Long productId, String sortBy) {
        LocalDate s = (startDate != null) ? startDate : LocalDate.now().minusDays(90);
        LocalDate e = (endDate != null) ? endDate : LocalDate.now();
        String orderCol;
        if (sortBy == null) sortBy = "revenue";
        switch (sortBy) {
            case "quantity": orderCol = "sales_quantity DESC"; break;
            case "conversionRate": orderCol = "conversion_rate DESC"; break;
            case "repurchaseRate": orderCol = "repurchase_rate DESC"; break;
            case "profit": orderCol = "estimated_profit DESC"; break;
            default: orderCol = "revenue DESC"; break;
        }
        List<Object> params = new ArrayList<>();
        params.add(companyId);
        params.add(s.atStartOfDay());
        params.add(e.plusDays(1).atStartOfDay());
        StringBuilder sql = new StringBuilder(
            "SELECT p.product_name, sh.shop_name AS channel, " +
            "COALESCE(SUM(o.order_quantity),0) AS sales_quantity, " +
            "COUNT(DISTINCT o.uniq) AS order_count, " +
            "COALESCE(SUM(o.pay_amt - COALESCE(o.cancel_amt,0)),0) AS revenue, " +
            "0 AS product_cost, COALESCE(SUM(o.shipping_fee),0) AS shipping_cost, " +
            "0 AS platform_fee, 0 AS ad_cost, 0 AS roas, " +
            "0 AS conversion_rate, 0 AS repurchase_rate, 0 AS avg_repurchase_days, " +
            "0 AS estimated_profit, 0 AS profit_margin, " +
            "0 AS current_stock, 0 AS estimated_stockout_days " +
            "FROM orders o " +
            "JOIN product p ON p.id = o.product_id " +
            "JOIN shop sh ON sh.id = o.shop_id " +
            "WHERE o.company_id = ? " +
            "AND COALESCE(o.pay_time, o.ord_time, o.wdate) BETWEEN ?::timestamp AND ?::timestamp " +
            "AND o.ord_status NOT IN ('취소완료','반품완료','교환완료') " +
            "AND o.product_id IS NOT NULL "
        );
        if (channel != null && !channel.isBlank() && !"전체".equals(channel)) {
            sql.append("AND sh.shop_name ILIKE ? ");
            params.add("%" + channel + "%");
        }
        if (productId != null) {
            sql.append("AND o.product_id = ? ");
            params.add(productId);
        }
        sql.append("GROUP BY p.product_name, sh.shop_name ORDER BY ").append(orderCol).append(" NULLS LAST");
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    public List<Map<String, Object>> getRepurchaseByProduct(Long companyId, LocalDate startDate, LocalDate endDate, Long productId, String channel) {
        LocalDate s = (startDate != null) ? startDate : LocalDate.now().minusDays(180);
        LocalDate e = (endDate != null) ? endDate : LocalDate.now();
        List<Object> params = new ArrayList<>();
        params.add(companyId);
        params.add(s.atStartOfDay());
        params.add(e.plusDays(1).atStartOfDay());
        StringBuilder sql = new StringBuilder(
            "SELECT p.product_name, " +
            "COUNT(DISTINCT cstats.customer_id) FILTER (WHERE cstats.order_cnt >= 1) AS first_purchase_users, " +
            "COUNT(DISTINCT cstats.customer_id) FILTER (WHERE cstats.order_cnt >= 2) AS second_purchase_users, " +
            "COUNT(DISTINCT cstats.customer_id) FILTER (WHERE cstats.order_cnt >= 3) AS third_purchase_users, " +
            "COUNT(DISTINCT cstats.customer_id) FILTER (WHERE cstats.order_cnt >= 4) AS fourth_purchase_users, " +
            "COUNT(DISTINCT cstats.customer_id) FILTER (WHERE cstats.order_cnt >= 5) AS fifth_plus_purchase_users, " +
            "ROUND(COUNT(DISTINCT cstats.customer_id) FILTER (WHERE cstats.order_cnt >= 2)::numeric / " +
            "NULLIF(COUNT(DISTINCT cstats.customer_id) FILTER (WHERE cstats.order_cnt >= 1),0)*100,1) AS repurchase_rate_30d, " +
            "ROUND(COUNT(DISTINCT cstats.customer_id) FILTER (WHERE cstats.order_cnt >= 2)::numeric / " +
            "NULLIF(COUNT(DISTINCT cstats.customer_id) FILTER (WHERE cstats.order_cnt >= 1),0)*100,1) AS repurchase_rate_60d, " +
            "ROUND(COUNT(DISTINCT cstats.customer_id) FILTER (WHERE cstats.order_cnt >= 2)::numeric / " +
            "NULLIF(COUNT(DISTINCT cstats.customer_id) FILTER (WHERE cstats.order_cnt >= 1),0)*100,1) AS repurchase_rate_90d, " +
            "0 AS avg_repurchase_days " +
            "FROM (SELECT o.customer_id, o.product_id, COUNT(*) AS order_cnt " +
            "FROM orders o " +
            "WHERE o.company_id = ? " +
            "AND COALESCE(o.pay_time, o.ord_time, o.wdate) BETWEEN ?::timestamp AND ?::timestamp " +
            "AND o.customer_id IS NOT NULL " +
            "AND o.ord_status NOT IN ('취소완료','반품완료','교환완료') " +
            "GROUP BY o.customer_id, o.product_id) cstats " +
            "JOIN product p ON p.id = cstats.product_id " +
            "WHERE 1=1 "
        );
        if (productId != null) {
            sql.append("AND cstats.product_id = ? ");
            params.add(productId);
        }
        sql.append("GROUP BY p.product_name ORDER BY first_purchase_users DESC NULLS LAST");
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    public List<Map<String, Object>> getChannelProductMatrix(Long companyId, LocalDate startDate, LocalDate endDate) {
        LocalDate s = (startDate != null) ? startDate : LocalDate.now().minusDays(90);
        LocalDate e = (endDate != null) ? endDate : LocalDate.now();
        return jdbcTemplate.queryForList(
            "SELECT p.product_name, sh.shop_name AS channel, " +
            "COALESCE(SUM(o.pay_amt - COALESCE(o.cancel_amt,0)),0) AS revenue, " +
            "COALESCE(SUM(o.order_quantity),0) AS sales_quantity, " +
            "0 AS roas, 0 AS repurchase_rate, 0 AS profit_margin " +
            "FROM orders o " +
            "JOIN product p ON p.id = o.product_id " +
            "JOIN shop sh ON sh.id = o.shop_id " +
            "WHERE o.company_id = ? " +
            "AND COALESCE(o.pay_time, o.ord_time, o.wdate) BETWEEN ?::timestamp AND ?::timestamp " +
            "AND o.ord_status NOT IN ('취소완료','반품완료','교환완료') " +
            "AND o.product_id IS NOT NULL " +
            "GROUP BY p.product_name, sh.shop_name " +
            "ORDER BY p.product_name, revenue DESC NULLS LAST",
            companyId, s.atStartOfDay(), e.plusDays(1).atStartOfDay()
        );
    }

}


