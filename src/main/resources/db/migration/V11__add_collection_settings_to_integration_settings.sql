ALTER TABLE integration_settings
    ADD COLUMN IF NOT EXISTS collection_unit VARCHAR(20),
    ADD COLUMN IF NOT EXISTS collection_value INTEGER,
    ADD COLUMN IF NOT EXISTS schedule_unit VARCHAR(20),
    ADD COLUMN IF NOT EXISTS schedule_value INTEGER,
    ADD COLUMN IF NOT EXISTS auto_collect_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_collected_at TIMESTAMP;
