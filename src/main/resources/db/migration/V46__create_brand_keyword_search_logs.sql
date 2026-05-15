CREATE TABLE IF NOT EXISTS brand_keyword_search_logs (
    id BIGSERIAL PRIMARY KEY,
    keyword VARCHAR(200) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    title TEXT,
    description TEXT,
    link TEXT,
    published_at VARCHAR(80),
    searched_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_keyword_search_logs_keyword
    ON brand_keyword_search_logs(keyword, searched_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_keyword_search_logs_channel
    ON brand_keyword_search_logs(channel, searched_at DESC);
