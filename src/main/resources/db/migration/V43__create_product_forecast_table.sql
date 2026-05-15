CREATE TABLE IF NOT EXISTS executive_product_forecast (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    product_name VARCHAR(160) NOT NULL,
    brand_name VARCHAR(80) NOT NULL DEFAULT '하이프리',
    category VARCHAR(80),
    npd_stage VARCHAR(40) NOT NULL DEFAULT 'IDEA',
    launch_month DATE,
    forecast_months INTEGER NOT NULL DEFAULT 1,
    expected_monthly_units INTEGER NOT NULL DEFAULT 0,
    expected_selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    unit_production_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    platform_fee_rate NUMERIC(7, 2) NOT NULL DEFAULT 6,
    ad_cost_rate NUMERIC(7, 2) NOT NULL DEFAULT 10,
    operating_admin_rate NUMERIC(7, 2) NOT NULL DEFAULT 15,
    logistics_cost_per_unit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expected_sales NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expected_gross_profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expected_gross_margin_rate NUMERIC(7, 2) NOT NULL DEFAULT 0,
    expected_operating_profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expected_operating_margin_rate NUMERIC(7, 2) NOT NULL DEFAULT 0,
    memo VARCHAR(700),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executive_product_forecast_company
    ON executive_product_forecast(company_id);

CREATE INDEX IF NOT EXISTS idx_executive_product_forecast_launch_month
    ON executive_product_forecast(company_id, launch_month);
