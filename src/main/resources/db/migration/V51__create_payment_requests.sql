CREATE TABLE IF NOT EXISTS executive_payment_request (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    request_type VARCHAR(40) NOT NULL DEFAULT 'EXPENSE_APPROVAL',
    flow_type VARCHAR(20) NOT NULL DEFAULT 'OUTFLOW',
    project_name VARCHAR(160),
    linked_product_name VARCHAR(160),
    counterparty VARCHAR(120),
    requester_name VARCHAR(80) NOT NULL,
    department VARCHAR(80),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scheduled_date DATE NOT NULL,
    account_name VARCHAR(120),
    purpose VARCHAR(240) NOT NULL,
    detail_reason TEXT,
    evidence_url TEXT,
    expense_category VARCHAR(80) NOT NULL DEFAULT '운영비',
    urgent BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    review_comment TEXT,
    cash_flow_id BIGINT REFERENCES executive_cash_flow(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executive_payment_request_company
    ON executive_payment_request(company_id);

CREATE INDEX IF NOT EXISTS idx_executive_payment_request_status_date
    ON executive_payment_request(company_id, status, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_executive_payment_request_cash_flow
    ON executive_payment_request(cash_flow_id);
