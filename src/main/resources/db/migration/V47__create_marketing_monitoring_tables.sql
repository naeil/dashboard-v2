CREATE TABLE IF NOT EXISTS keyword_trend_logs (
    id BIGSERIAL PRIMARY KEY,
    keyword VARCHAR(200) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    title TEXT,
    description TEXT,
    link TEXT,
    published_at VARCHAR(80),
    searched_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_keyword_trend_logs_keyword ON keyword_trend_logs(keyword);
CREATE INDEX IF NOT EXISTS idx_keyword_trend_logs_channel ON keyword_trend_logs(channel);
CREATE INDEX IF NOT EXISTS idx_keyword_trend_logs_searched_at ON keyword_trend_logs(searched_at);

CREATE TABLE IF NOT EXISTS naver_cpc_daily_stats (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    campaign_name VARCHAR(255),
    ad_group_name VARCHAR(255),
    keyword VARCHAR(255),
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    ctr NUMERIC(10, 2) DEFAULT 0,
    avg_cpc NUMERIC(15, 2) DEFAULT 0,
    cost NUMERIC(15, 2) DEFAULT 0,
    conversions BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_naver_cpc_daily_stats_date ON naver_cpc_daily_stats(date);
CREATE INDEX IF NOT EXISTS idx_naver_cpc_daily_stats_keyword ON naver_cpc_daily_stats(keyword);

CREATE TABLE IF NOT EXISTS meta_ads_daily_stats (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    campaign_name VARCHAR(255),
    adset_name VARCHAR(255),
    ad_name VARCHAR(255),
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    ctr NUMERIC(10, 2) DEFAULT 0,
    cpc NUMERIC(15, 2) DEFAULT 0,
    cpm NUMERIC(15, 2) DEFAULT 0,
    cost NUMERIC(15, 2) DEFAULT 0,
    conversions BIGINT,
    roas NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_daily_stats_date ON meta_ads_daily_stats(date);
CREATE INDEX IF NOT EXISTS idx_meta_ads_daily_stats_campaign ON meta_ads_daily_stats(campaign_name);

CREATE TABLE IF NOT EXISTS marketing_ai_analysis_logs (
    id BIGSERIAL PRIMARY KEY,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    analysis_type VARCHAR(80) NOT NULL,
    summary TEXT,
    risks TEXT,
    recommended_actions TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
