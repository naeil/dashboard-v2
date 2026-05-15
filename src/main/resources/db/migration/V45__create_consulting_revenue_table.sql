CREATE TABLE IF NOT EXISTS executive_consulting_revenue (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL DEFAULT 1,
    client_name VARCHAR(160) NOT NULL,
    project_name VARCHAR(200) NOT NULL,
    consulting_type VARCHAR(80),
    contract_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expected_payment_date DATE,
    start_date DATE,
    end_date DATE,
    labor_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    outsourcing_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    other_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    gross_profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    operating_profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    operating_margin_rate NUMERIC(7, 2) NOT NULL DEFAULT 0,
    status VARCHAR(40) NOT NULL DEFAULT 'LEAD',
    owner_name VARCHAR(80),
    memo TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executive_consulting_revenue_company
    ON executive_consulting_revenue(company_id);

CREATE INDEX IF NOT EXISTS idx_executive_consulting_revenue_payment_date
    ON executive_consulting_revenue(expected_payment_date);
