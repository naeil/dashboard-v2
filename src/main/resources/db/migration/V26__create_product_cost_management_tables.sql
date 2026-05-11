CREATE TABLE product_cost_profile (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    sgna_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    logistics_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    packaging_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    other_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_cost_profile_company_product UNIQUE (company_id, product_id)
);

CREATE INDEX idx_product_cost_profile_company ON product_cost_profile(company_id);
CREATE INDEX idx_product_cost_profile_product ON product_cost_profile(product_id);

CREATE TABLE product_channel_cost (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    shop_id BIGINT NOT NULL REFERENCES shop(id) ON DELETE CASCADE,
    channel_fee_type VARCHAR(20) NOT NULL DEFAULT 'RATE',
    channel_fee_value NUMERIC(12,2) NOT NULL DEFAULT 0,
    ad_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    return_exchange_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_channel_cost_company_product_shop UNIQUE (company_id, product_id, shop_id),
    CONSTRAINT ck_product_channel_cost_fee_type CHECK (channel_fee_type IN ('RATE', 'FIXED'))
);

CREATE INDEX idx_product_channel_cost_company ON product_channel_cost(company_id);
CREATE INDEX idx_product_channel_cost_product ON product_channel_cost(product_id);
CREATE INDEX idx_product_channel_cost_shop ON product_channel_cost(shop_id);
