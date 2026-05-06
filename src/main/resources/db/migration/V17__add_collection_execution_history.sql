CREATE TABLE collection_execution_history (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL,
    job_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collection_execution_history_main
    ON collection_execution_history (company_id, integration_type, started_at DESC);

CREATE INDEX idx_collection_execution_history_status
    ON collection_execution_history (status, started_at DESC);
