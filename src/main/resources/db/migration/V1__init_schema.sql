-- ============================================================
-- V1 : Initial Schema
-- Multi-tenant SaaS Analytics Dashboard
-- ============================================================

-- -------------------------------------------------------
-- company
-- -------------------------------------------------------
CREATE TABLE company (
    id         BIGSERIAL    PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- store
-- -------------------------------------------------------
CREATE TABLE store (
    id         BIGSERIAL    PRIMARY KEY,
    company_id BIGINT       NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    store_name VARCHAR(100) NOT NULL,
    platform   VARCHAR(30)  NOT NULL
                            CHECK (platform IN ('NAVER','META','COUPANG','KAKAO',
                                                'GMARKET','ELEVENST','AUCTION',
                                                'IMWEB','SMARTSTORE','OTHER')),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_store_company ON store (company_id);

-- -------------------------------------------------------
-- brand
-- -------------------------------------------------------
CREATE TABLE brand (
    id         BIGSERIAL    PRIMARY KEY,
    company_id BIGINT       NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    brand_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brand_company ON brand (company_id);

-- -------------------------------------------------------
-- product
-- -------------------------------------------------------
CREATE TABLE product (
    id                  BIGSERIAL    PRIMARY KEY,
    company_id          BIGINT       NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    brand_id            BIGINT       NOT NULL REFERENCES brand(id),
    product_name        VARCHAR(200) NOT NULL,
    external_product_id VARCHAR(100),          -- PlayAuto ID
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_company ON product (company_id);
CREATE INDEX idx_product_brand   ON product (company_id, brand_id);

-- -------------------------------------------------------
-- daily_sales_stats  (core aggregation table)
-- -------------------------------------------------------
CREATE TABLE daily_sales_stats (
    id              BIGSERIAL      PRIMARY KEY,
    company_id      BIGINT         NOT NULL REFERENCES company(id),
    date            DATE           NOT NULL,
    store_id        BIGINT         NOT NULL REFERENCES store(id),
    brand_id        BIGINT         NOT NULL REFERENCES brand(id),
    product_id      BIGINT         NOT NULL REFERENCES product(id),
    gross_amount    NUMERIC(18,2)  NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18,2)  NOT NULL DEFAULT 0,
    net_revenue     NUMERIC(18,2)  NOT NULL DEFAULT 0,
    shipping_fee    NUMERIC(18,2)  NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_daily_sales
        UNIQUE (company_id, date, store_id, brand_id, product_id)
);

-- Required indexes (from spec)
CREATE INDEX idx_sales_company_date       ON daily_sales_stats (company_id, date);
CREATE INDEX idx_sales_company_date_brand ON daily_sales_stats (company_id, date, brand_id);
CREATE INDEX idx_sales_company_date_store ON daily_sales_stats (company_id, date, store_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_sales_updated_at
    BEFORE UPDATE ON daily_sales_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
