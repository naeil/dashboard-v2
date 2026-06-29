ALTER TABLE ai_provider_settings
    ADD COLUMN IF NOT EXISTS last_model_synced_at TIMESTAMP;
