ALTER TABLE integration_settings
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP;
