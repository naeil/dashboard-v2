ALTER TABLE executive_cash_flow
    ADD COLUMN confidence_level VARCHAR(30) NOT NULL DEFAULT 'EXPECTED',
    ADD COLUMN recurring_rule VARCHAR(30);

UPDATE executive_cash_flow
SET confidence_level = CASE
    WHEN category IN ('급여', '세금', '임대료', '대출 상환') THEN 'CONFIRMED'
    WHEN status = 'DONE' THEN 'CONFIRMED'
    ELSE 'EXPECTED'
END;

CREATE INDEX idx_executive_cash_flow_company_date
    ON executive_cash_flow(company_id, flow_date);
