CREATE TABLE IF NOT EXISTS product_outbound (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    brand_id BIGINT NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
    outbound_date DATE NOT NULL,
    outbound_count INTEGER NOT NULL DEFAULT 0,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_outbound UNIQUE (company_id, product_id, outbound_date)
);

CREATE INDEX IF NOT EXISTS idx_product_outbound_company_date
    ON product_outbound (company_id, outbound_date);

CREATE INDEX IF NOT EXISTS idx_product_outbound_company_product
    ON product_outbound (company_id, product_id);
