ALTER TABLE executive_ad_performance
    ADD COLUMN IF NOT EXISTS product_name VARCHAR(160);

CREATE TABLE IF NOT EXISTS executive_ad_roas_goal (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    period_type VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    product_name VARCHAR(160),
    ad_type VARCHAR(40) NOT NULL DEFAULT 'ALL',
    target_roas NUMERIC(9, 2) NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    owner_name VARCHAR(80),
    memo VARCHAR(500),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executive_ad_roas_goal_company_period
    ON executive_ad_roas_goal(company_id, period_type, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_executive_ad_roas_goal_product
    ON executive_ad_roas_goal(company_id, product_name, ad_type);
