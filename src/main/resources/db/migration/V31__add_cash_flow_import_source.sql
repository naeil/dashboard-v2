ALTER TABLE executive_cash_flow
    ADD COLUMN source_type VARCHAR(40),
    ADD COLUMN source_key VARCHAR(160);

CREATE UNIQUE INDEX uq_executive_cash_flow_source_key
    ON executive_cash_flow(source_key)
    WHERE source_key IS NOT NULL;
