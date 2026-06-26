-- V109: client_performance 테이블에 margin_rate, new_client_incentive 컬럼 추가
-- 추정 영업이익 기반 마진율 등급제 인센티브 시스템 지원

ALTER TABLE client_performance
    ADD COLUMN IF NOT EXISTS margin_rate DOUBLE PRECISION DEFAULT 0.0;

ALTER TABLE client_performance
    ADD COLUMN IF NOT EXISTS new_client_incentive BIGINT DEFAULT 50000;

COMMENT ON COLUMN client_performance.margin_rate IS '상품별 고정 마진율 (%, 예: 25.0 = 25%)';
COMMENT ON COLUMN client_performance.new_client_incentive IS '신규 거래처 등록 인센티브 (고정 50,000원)';
