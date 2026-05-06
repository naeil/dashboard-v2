CREATE TABLE integration_settings (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    integration_type VARCHAR(50) NOT NULL,
    api_key VARCHAR(500),
    access_token VARCHAR(500),
    token_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, integration_type)
);
