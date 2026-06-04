-- ============================================================
-- 제품 원가 관리 시스템
-- ============================================================

-- 1. SKU 마스터: 제품별 기본 원가 정보 (물류비 계산 기준)
CREATE TABLE IF NOT EXISTS product_sku_master (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT          NOT NULL REFERENCES company(id),
    sku_code        VARCHAR(50)     NOT NULL,           -- 플레이오토 SKU 코드 (e.g. 1004)
    product_name    VARCHAR(200)    NOT NULL,
    weight_g        INTEGER         NOT NULL DEFAULT 0, -- 무게(g)
    temp_type       VARCHAR(10)     NOT NULL DEFAULT '상온', -- '상온' | '냉동'
    production_cost NUMERIC(12, 2)  NOT NULL DEFAULT 0, -- 생산원가(개당)
    note            VARCHAR(500),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, sku_code)
);

-- 2. 물류비 구간 테이블
CREATE TABLE IF NOT EXISTS logistics_fee_config (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT          NOT NULL REFERENCES company(id),
    temp_type       VARCHAR(10)     NOT NULL,           -- '상온' | '냉동'
    weight_limit_g  INTEGER         NOT NULL,           -- 해당 구간 상한 무게(g). 999999 = 초과
    fee             NUMERIC(10, 2)  NOT NULL DEFAULT 0, -- 택배비(원)
    UNIQUE (company_id, temp_type, weight_limit_g)
);

-- 3. 채널별 제품 원가 매핑
--    product_code = 플레이오토 상품코드 (orders.product_code 와 조인)
CREATE TABLE IF NOT EXISTS product_cost_channel (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT          NOT NULL REFERENCES company(id),
    channel_name        VARCHAR(50)     NOT NULL,       -- '스마트스토어팜' | '쿠팡' | '자사몰' | '11번가' | '지마켓' | '옥션' | '카카오톡스토어'
    product_code        VARCHAR(100)    NOT NULL,       -- 채널 상품코드 (PlayAuto product_code)
    product_name        VARCHAR(200)    NOT NULL,
    sku_code            VARCHAR(50),                    -- product_sku_master.sku_code (물류비 계산용)
    qty_per_unit        INTEGER         NOT NULL DEFAULT 1, -- 판매 단위 내 낱개 수 (물류비 × qty)
    production_cost     NUMERIC(12, 2)  NOT NULL DEFAULT 0, -- 생산원가 (채널 판매단위 기준)
    list_price          NUMERIC(12, 2)  NOT NULL DEFAULT 0, -- 정가
    consumer_price      NUMERIC(12, 2)  NOT NULL DEFAULT 0, -- 소비자가
    channel_fee_rate    NUMERIC(6, 4)   NOT NULL DEFAULT 0, -- 채널 수수료율 (0.06 = 6%)
    marketing_rate      NUMERIC(6, 4)   NOT NULL DEFAULT 0.03, -- 마케팅비율 (기본 3%)
    ad_rate             NUMERIC(6, 4)   NOT NULL DEFAULT 0.10, -- 광고비율
    opex_rate           NUMERIC(6, 4)   NOT NULL DEFAULT 0.15, -- 운영판관비율 (기본 15%)
    consumer_ship_fee   NUMERIC(10, 2)  NOT NULL DEFAULT 0,    -- 소비자 부담 배송비
    storage_fee_unit    NUMERIC(10, 2)  NOT NULL DEFAULT 0,    -- 보관비(개당)
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    note                VARCHAR(500),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, channel_name, product_code)
);

CREATE INDEX IF NOT EXISTS idx_product_cost_channel_company
    ON product_cost_channel (company_id, channel_name);
CREATE INDEX IF NOT EXISTS idx_product_cost_channel_code
    ON product_cost_channel (company_id, product_code);
CREATE INDEX IF NOT EXISTS idx_product_sku_master_company
    ON product_sku_master (company_id, sku_code);

-- 기본 물류비 데이터 삽입 (냉동 구간별, 상온 flat)
INSERT INTO logistics_fee_config (company_id, temp_type, weight_limit_g, fee) VALUES
-- 냉동
(1, '냉동', 1000,   4250),
(1, '냉동', 2000,   4550),
(1, '냉동', 3000,   4860),
(1, '냉동', 4000,   5010),
(1, '냉동', 5000,   5590),
(1, '냉동', 6000,   6550),
(1, '냉동', 999999, 7500),
-- 상온
(1, '상온', 999999, 3200)
ON CONFLICT (company_id, temp_type, weight_limit_g) DO NOTHING;
