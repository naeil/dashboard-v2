CREATE TABLE IF NOT EXISTS company_menu_config (
    company_id BIGINT PRIMARY KEY,
    config JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
