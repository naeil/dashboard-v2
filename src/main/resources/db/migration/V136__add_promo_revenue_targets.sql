-- V136: 실시간 프로젝트 — 예상 매출·최종 목표 매출 직접 입력, 실매출 대비 BPE(손익분기) 달성 확인용
ALTER TABLE promo_event ADD COLUMN IF NOT EXISTS expected_revenue BIGINT NOT NULL DEFAULT 0;
ALTER TABLE promo_event ADD COLUMN IF NOT EXISTS target_revenue   BIGINT NOT NULL DEFAULT 0;
