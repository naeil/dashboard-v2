-- V128: 생산 관리 — 공급처/발주서/발주 품목/설정
CREATE TABLE IF NOT EXISTS supplier (
    id            BIGSERIAL PRIMARY KEY,
    company_id    BIGINT NOT NULL DEFAULT 1,
    supplier_name VARCHAR(120) NOT NULL,
    contact       VARCHAR(120),          -- 담당자·연락처
    payment_terms VARCHAR(120),          -- 결제 조건
    lead_days     INTEGER NOT NULL DEFAULT 14,
    memo          VARCHAR(300),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_supplier UNIQUE (company_id, supplier_name)
);

CREATE TABLE IF NOT EXISTS purchase_order (
    id            BIGSERIAL PRIMARY KEY,
    company_id    BIGINT NOT NULL DEFAULT 1,
    supplier_id   BIGINT REFERENCES supplier(id),
    order_type    VARCHAR(20) NOT NULL DEFAULT 'PRODUCTION',  -- PRODUCTION(생산) | PURCHASE(사입)
    status        VARCHAR(20) NOT NULL DEFAULT 'ORDERED',     -- ORDERED | RECEIVED | CANCELED
    order_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE,                                       -- 입고 예정일
    received_date DATE,
    memo          VARCHAR(300),
    created_by    VARCHAR(80),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchase_order_status ON purchase_order (company_id, status, expected_date);

CREATE TABLE IF NOT EXISTS purchase_order_item (
    id         BIGSERIAL PRIMARY KEY,
    po_id      BIGINT NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
    company_id BIGINT NOT NULL DEFAULT 1,
    product_id BIGINT REFERENCES product(id),
    item_name  VARCHAR(200) NOT NULL,
    qty        INTEGER NOT NULL DEFAULT 0,
    unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount     NUMERIC(16,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_purchase_order_item_po ON purchase_order_item (po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_item_name ON purchase_order_item (company_id, item_name);

-- 원가 경고 임계치 (직전 발주 단가 대비 %)
CREATE TABLE IF NOT EXISTS production_config (
    company_id      BIGINT PRIMARY KEY,
    price_alert_pct NUMERIC(6,2) NOT NULL DEFAULT 10,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO production_config (company_id) VALUES (1) ON CONFLICT (company_id) DO NOTHING;
