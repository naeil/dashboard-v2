ALTER TABLE integration_settings
    ADD COLUMN IF NOT EXISTS api_extra TEXT;
