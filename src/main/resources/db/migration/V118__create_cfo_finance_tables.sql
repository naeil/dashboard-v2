-- ============================================================
-- V118: CFO 재무관리 페이지 기반 테이블
-- 원칙: 기존 테이블은 변경하지 않는다 (순수 추가).
--  - 원가/수수료 기간별 이력 (과거 주문은 당시 요율로 계산)
--  - 예산/목표, 반복 고정비, 재무 경보
--  - 모든 금액 NUMERIC, soft delete, 감사 컬럼 포함
-- ============================================================

-- 1) 채널 수수료 기간별 이력
--    product_code IS NULL 이면 채널 공통 요율, 있으면 상품별 요율(우선 적용)
CREATE TABLE IF NOT EXISTS cfo_channel_fee_history (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT        NOT NULL REFERENCES company(id),
    channel_name    VARCHAR(80)   NOT NULL,
    product_code    VARCHAR(100),
    fee_rate_pct    NUMERIC(7,3)  NOT NULL DEFAULT 0,  -- 판매 수수료율 (%)
    payment_fee_pct NUMERIC(7,3)  NOT NULL DEFAULT 0,  -- 결제 수수료율 (%)
    logistics_fee   NUMERIC(12,2) NOT NULL DEFAULT 0,  -- 건당 물류/입출고 수수료(원)
    storage_fee     NUMERIC(12,2) NOT NULL DEFAULT 0,  -- 개당 보관료(원)
    vat_included    BOOLEAN       NOT NULL DEFAULT TRUE,
    settlement_days INTEGER,                            -- 평균 정산주기(일)
    effective_from  DATE          NOT NULL DEFAULT DATE '2000-01-01',
    effective_to    DATE,                               -- NULL = 현재 유효
    memo            VARCHAR(500),
    created_by      VARCHAR(100),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cfo_fee_hist_lookup
    ON cfo_channel_fee_history (company_id, channel_name, product_code, effective_from);

-- 2) 상품 원가 기간별 이력
CREATE TABLE IF NOT EXISTS cfo_product_cost_history (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT        NOT NULL REFERENCES company(id),
    channel_name    VARCHAR(80),                        -- NULL = 채널 공통
    product_code    VARCHAR(100)  NOT NULL,             -- orders.sku_cd / product_cost_channel.product_code
    sku_code        VARCHAR(50),
    product_name    VARCHAR(200),
    production_cost NUMERIC(12,2) NOT NULL DEFAULT 0,   -- 판매단위당 제조원가(원)
    packaging_cost  NUMERIC(12,2) NOT NULL DEFAULT 0,
    vat_included    BOOLEAN       NOT NULL DEFAULT FALSE,
    effective_from  DATE          NOT NULL DEFAULT DATE '2000-01-01',
    effective_to    DATE,
    source          VARCHAR(30)   NOT NULL DEFAULT 'MANUAL', -- MANUAL | SEED | UPLOAD
    memo            VARCHAR(500),
    created_by      VARCHAR(100),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cfo_cost_hist_lookup
    ON cfo_product_cost_history (company_id, product_code, effective_from);

-- 3) 예산 / 목표 (월 × 유형 × 카테고리)
CREATE TABLE IF NOT EXISTS cfo_budget (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT        NOT NULL REFERENCES company(id),
    budget_month    DATE          NOT NULL,             -- 해당 월 1일
    budget_type     VARCHAR(20)   NOT NULL,             -- REVENUE | GROSS_PROFIT | CONTRIBUTION | OPERATING_PROFIT | EXPENSE | AD | LABOR | FIXED | PRODUCTION | CASH | RECEIVABLE_COLLECT | INVENTORY_REDUCE | DEBT_REPAY
    category        VARCHAR(120)  NOT NULL DEFAULT '전체', -- 브랜드/상품/채널/비용 카테고리
    amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
    memo            VARCHAR(500),
    created_by      VARCHAR(100),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (company_id, budget_month, budget_type, category)
);
CREATE INDEX IF NOT EXISTS idx_cfo_budget_month ON cfo_budget (company_id, budget_month);

-- 4) 반복 고정비 정의 (매월 현금흐름/손익에 자동 반영)
CREATE TABLE IF NOT EXISTS cfo_recurring_expense (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT        NOT NULL REFERENCES company(id),
    expense_name    VARCHAR(160)  NOT NULL,
    category        VARCHAR(80)   NOT NULL DEFAULT '기타', -- 급여/4대보험/임대료/관리비/구독료/보험료/대출이자/세무비/차량비/서버비/기타
    amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
    payment_day     INTEGER       NOT NULL DEFAULT 25,  -- 매월 결제일 (1~31)
    cycle           VARCHAR(20)   NOT NULL DEFAULT 'MONTHLY', -- MONTHLY | QUARTERLY | YEARLY
    start_month     DATE          NOT NULL DEFAULT DATE '2000-01-01',
    end_month       DATE,                               -- NULL = 계속
    auto_renew      BOOLEAN       NOT NULL DEFAULT TRUE,
    vendor          VARCHAR(160),
    vat_included    BOOLEAN       NOT NULL DEFAULT TRUE,
    manager_name    VARCHAR(80),
    memo            VARCHAR(500),
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_by      VARCHAR(100),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cfo_recurring_company ON cfo_recurring_expense (company_id, is_active);

-- 5) 재무 경보 (룰 엔진 결과 + 처리 상태 추적)
CREATE TABLE IF NOT EXISTS cfo_alert (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT        NOT NULL REFERENCES company(id),
    alert_date      DATE          NOT NULL DEFAULT CURRENT_DATE,
    severity        VARCHAR(20)   NOT NULL,             -- CRITICAL | WARNING | OPPORTUNITY
    rule_key        VARCHAR(80)   NOT NULL,             -- 규칙 식별자
    dedupe_key      VARCHAR(200)  NOT NULL,             -- 동일 경보 중복 방지 키
    title           VARCHAR(240)  NOT NULL,
    description     VARCHAR(1000),
    cause           VARCHAR(500),
    impact_amount   NUMERIC(18,2),
    recommendation  VARCHAR(500),
    assignee        VARCHAR(80),
    status          VARCHAR(20)   NOT NULL DEFAULT 'OPEN', -- OPEN | ACK | RESOLVED | DISMISSED
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_cfo_alert_open ON cfo_alert (company_id, status, severity);

-- ============================================================
-- 초기 시드: 현행 설정값을 이력의 최초 구간으로 복사
-- (과거 주문도 우선 현행 요율로 계산 가능하게 함. 이후 요율 변경 시
--  effective_to 마감 + 새 구간 추가로 이력이 쌓인다)
-- ============================================================

-- 채널 공통 수수료: settlement_schedule_rules 의 fee_rate(%) 사용
INSERT INTO cfo_channel_fee_history (company_id, channel_name, product_code, fee_rate_pct, settlement_days, effective_from, memo, created_by)
SELECT r.company_id, r.channel_name, NULL, COALESCE(r.fee_rate, 0),
       CASE WHEN r.cycle_type = 'D+N' AND r.cycle_value ~ '^[0-9]+$' THEN r.cycle_value::integer ELSE NULL END,
       DATE '2000-01-01', '정산 규칙에서 자동 시드', 'V118_SEED'
FROM settlement_schedule_rules r
WHERE NOT EXISTS (
    SELECT 1 FROM cfo_channel_fee_history h
    WHERE h.company_id = r.company_id AND h.channel_name = r.channel_name AND h.product_code IS NULL
);

-- 상품×채널 수수료: product_cost_channel 의 channel_fee_rate(소수) → %
INSERT INTO cfo_channel_fee_history (company_id, channel_name, product_code, fee_rate_pct, logistics_fee, storage_fee, effective_from, memo, created_by)
SELECT p.company_id, p.channel_name, p.product_code,
       ROUND(p.channel_fee_rate * 100, 3), 0, COALESCE(p.storage_fee_unit, 0),
       DATE '2000-01-01', '원가 마스터에서 자동 시드', 'V118_SEED'
FROM product_cost_channel p
WHERE p.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM cfo_channel_fee_history h
    WHERE h.company_id = p.company_id AND h.channel_name = p.channel_name AND h.product_code = p.product_code
);

-- 상품 원가: product_cost_channel 의 production_cost (판매단위 기준)
INSERT INTO cfo_product_cost_history (company_id, channel_name, product_code, sku_code, product_name, production_cost, effective_from, source, created_by)
SELECT p.company_id, p.channel_name, p.product_code, p.sku_code, p.product_name,
       COALESCE(p.production_cost, 0), DATE '2000-01-01', 'SEED', 'V118_SEED'
FROM product_cost_channel p
WHERE p.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM cfo_product_cost_history h
    WHERE h.company_id = p.company_id AND COALESCE(h.channel_name, '') = COALESCE(p.channel_name, '')
      AND h.product_code = p.product_code
);
