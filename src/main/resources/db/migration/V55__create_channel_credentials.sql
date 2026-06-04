CREATE TABLE IF NOT EXISTS executive_channel_credential (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    channel_id VARCHAR(60) NOT NULL,
    channel_name VARCHAR(120) NOT NULL,
    login_url TEXT NOT NULL,
    username VARCHAR(255),
    password_cipher TEXT,
    memo TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by VARCHAR(80),
    updated_by VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_executive_channel_credential UNIQUE (company_id, channel_id),
    CONSTRAINT chk_executive_channel_credential_status CHECK (status IN ('ACTIVE', 'HOLD', 'DISABLED'))
);

CREATE INDEX IF NOT EXISTS idx_executive_channel_credential_company_status
    ON executive_channel_credential(company_id, status, channel_name);
