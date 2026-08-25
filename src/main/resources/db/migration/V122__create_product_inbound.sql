-- V122: 입고 이력 테이블 — 정산시트 [raw]재고/입고관리 입고 블록 수집용
CREATE TABLE IF NOT EXISTS product_inbound (
    id            BIGSERIAL PRIMARY KEY,
    company_id    BIGINT  NOT NULL,
    product_id    BIGINT  NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    brand_id      BIGINT,
    inbound_date  DATE    NOT NULL,
    inbound_count INTEGER NOT NULL DEFAULT 0,
    warehouse     VARCHAR(120) NOT NULL DEFAULT '',
    memo          VARCHAR(200),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_inbound UNIQUE (company_id, product_id, inbound_date, warehouse)
);
CREATE INDEX IF NOT EXISTS idx_product_inbound_company_date ON product_inbound (company_id, inbound_date);
