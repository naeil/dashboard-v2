ALTER TABLE executive_channel_performance
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS source_key VARCHAR(200);

CREATE UNIQUE INDEX IF NOT EXISTS uq_executive_channel_performance_source_key
    ON executive_channel_performance(source_key)
    WHERE source_key IS NOT NULL;
