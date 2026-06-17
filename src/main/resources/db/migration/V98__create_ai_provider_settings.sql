CREATE TABLE IF NOT EXISTS ai_provider_settings (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    provider VARCHAR(30) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    api_key TEXT NOT NULL,
    organization_id TEXT,
    project_id TEXT,
    validated_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ai_provider_company_provider UNIQUE (company_id, provider),
    CONSTRAINT fk_ai_provider_company FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_settings_company
    ON ai_provider_settings(company_id);
