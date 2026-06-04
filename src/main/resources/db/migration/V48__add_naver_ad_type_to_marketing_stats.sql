ALTER TABLE naver_cpc_daily_stats
    ADD COLUMN IF NOT EXISTS ad_type VARCHAR(40) NOT NULL DEFAULT 'POWERLINK',
    ADD COLUMN IF NOT EXISTS conversion_value NUMERIC(15, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS roas NUMERIC(10, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_naver_cpc_daily_stats_ad_type ON naver_cpc_daily_stats(ad_type);
