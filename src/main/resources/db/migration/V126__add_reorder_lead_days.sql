-- V126: 종합 상황판 — 상품별 재발주 리드타임(발주→입고 소요일)
ALTER TABLE product ADD COLUMN IF NOT EXISTS reorder_lead_days INTEGER NOT NULL DEFAULT 14;
