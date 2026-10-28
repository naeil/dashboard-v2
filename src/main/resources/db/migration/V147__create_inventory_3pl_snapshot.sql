-- V147: 3PL 일일재고표 업로드 이력 — 재고 현황 화면의 기준 데이터
-- payload: { ym, items: [{ sheet, raw, prev, in[31], out[31], stock[31] }], mapping: { 3PL품목키: product_profit_id } }
CREATE TABLE IF NOT EXISTS inventory_3pl_snapshot (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    as_of_date DATE NOT NULL,
    file_name VARCHAR(255),
    uploaded_by VARCHAR(120),
    item_count INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_3pl_snapshot_company_created
    ON inventory_3pl_snapshot (company_id, created_at DESC);
