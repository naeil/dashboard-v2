-- V110: executive_profit_plan에 product_master_key 컬럼 추가
-- 목적: 마스터-디테일 분리를 위한 준비 (문제 1 - 데이터 중복 해결 1단계)
-- 기존 데이터 보존: 마이그레이션은 additive (기존 데이터 삭제 없음)

-- 1. product_master_key 컬럼 추가 (nullable, 기존 데이터 백필 대상)
ALTER TABLE executive_profit_plan
  ADD COLUMN IF NOT EXISTS product_master_key VARCHAR(200);

-- 2. 백필: 기존 데이터에 product_name을 product_master_key로 설정
--    (같은 product_name = 같은 마스터 제품으로 간주)
UPDATE executive_profit_plan
SET product_master_key = product_name
WHERE product_master_key IS NULL;

-- 3. cogs_override, logistics_override 컬럼 추가 (채널 오버라이드용)
--    NULL이면 마스터 값 사용, NOT NULL이면 채널 전용 값
ALTER TABLE executive_profit_plan
  ADD COLUMN IF NOT EXISTS cogs_override NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS logistics_override NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS marketing_override NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS other_override NUMERIC(15, 2);

-- 4. 인덱스 추가 (마스터 키 기준 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_profit_plan_master_key
  ON executive_profit_plan (company_id, plan_month, product_master_key);

-- 참고: 
-- 현재 executive_profit_plan은 product_name 단위로 저장됨
-- 향후 백엔드에서 마스터 기준으로 집계/조회 로직 추가 예정
-- 프론트엔드는 기존 API 응답 구조 그대로 유지 (겉모습 동일)
