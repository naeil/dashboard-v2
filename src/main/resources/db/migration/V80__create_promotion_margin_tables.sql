-- V80: 프로모션 마진 설정 및 프로모션 내역 테이블 생성

-- 1. 프로모션 마진 서식(설정) 테이블
--    직원이 채널별로 프로모션 조건을 입력하고 "서식 저장" 시 여기에 저장됨
CREATE TABLE IF NOT EXISTS promotion_margin_form (
      id                  BIGSERIAL PRIMARY KEY,
      company_id          BIGINT NOT NULL REFERENCES company(id),
      created_by          VARCHAR(80) NOT NULL,           -- 작성자 username
    form_name           VARCHAR(200) NOT NULL,          -- 서식 이름
    channel             VARCHAR(20)  NOT NULL           -- 'online' | 'offline' | 'export'
                            CHECK (channel IN ('online','offline','export')),
      promotion_type      VARCHAR(60)  NOT NULL,          -- 할인, 번들, 쿠폰 등
    product_name        VARCHAR(200) NOT NULL,
      sku_code            VARCHAR(100),

    -- 판매 조건
    sale_price          NUMERIC(15,2) NOT NULL DEFAULT 0,   -- 판매가
    discount_rate       NUMERIC(5,2)  NOT NULL DEFAULT 0,   -- 할인율(%)
    discount_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,   -- 할인액

    -- 비용 구조
    cogs                NUMERIC(15,2) NOT NULL DEFAULT 0,   -- 매출원가
    logistics_cost      NUMERIC(15,2) NOT NULL DEFAULT 0,   -- 물류비
    marketing_cost      NUMERIC(15,2) NOT NULL DEFAULT 0,   -- 마케팅비
    platform_fee_rate   NUMERIC(5,2)  NOT NULL DEFAULT 0,   -- 플랫폼 수수료율(%)
    other_cost          NUMERIC(15,2) NOT NULL DEFAULT 0,   -- 기타비용

    -- 목표
    target_qty          INTEGER       NOT NULL DEFAULT 0,   -- 목표 수량
    target_revenue      NUMERIC(15,2) GENERATED ALWAYS AS (
                              (sale_price - discount_amount) * target_qty
                          ) STORED,                          -- 목표 매출(자동계산)

    -- 프로모션 기간
    promo_start_date    DATE          NOT NULL,
      promo_end_date      DATE          NOT NULL,

    status              VARCHAR(20)   NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','submitted','approved','rejected')),
      memo                TEXT,

    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  );

CREATE INDEX IF NOT EXISTS idx_pmf_company_channel
    ON promotion_margin_form (company_id, channel, promo_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_pmf_company_status
    ON promotion_margin_form (company_id, status);

-- 2. 프로모션 내역 테이블
--    서식 저장(submit) 시 자동으로 연동되는 실적 추적 테이블
CREATE TABLE IF NOT EXISTS promotion_history (
      id                  BIGSERIAL PRIMARY KEY,
      company_id          BIGINT NOT NULL REFERENCES company(id),
      form_id             BIGINT NOT NULL REFERENCES promotion_margin_form(id),
      created_by          VARCHAR(80) NOT NULL,
      channel             VARCHAR(20) NOT NULL
                              CHECK (channel IN ('online','offline','export')),
      promotion_type      VARCHAR(60) NOT NULL,
      product_name        VARCHAR(200) NOT NULL,
      sku_code            VARCHAR(100),

    -- 목표 (서식 저장 시점 스냅샷)
    target_revenue      NUMERIC(15,2) NOT NULL DEFAULT 0,
      target_qty          INTEGER       NOT NULL DEFAULT 0,
      target_operating_profit NUMERIC(15,2) NOT NULL DEFAULT 0,  -- 목표 영업이익

    -- 실적 (실시간 업데이트)
    actual_qty          INTEGER       NOT NULL DEFAULT 0,       -- 실제 판매 수량
    actual_revenue      NUMERIC(15,2) NOT NULL DEFAULT 0,       -- 실시간 매출
    actual_cogs         NUMERIC(15,2) NOT NULL DEFAULT 0,       -- 실제 원가 합계
    actual_logistics    NUMERIC(15,2) NOT NULL DEFAULT 0,       -- 실제 물류비
    actual_marketing    NUMERIC(15,2) NOT NULL DEFAULT 0,       -- 실제 마케팅비
    actual_platform_fee NUMERIC(15,2) NOT NULL DEFAULT 0,       -- 실제 플랫폼 수수료
    actual_other_cost   NUMERIC(15,2) NOT NULL DEFAULT 0,       -- 실제 기타비용

    -- 계산 컬럼 (실시간 영업이익 = 매출 - 원가 - 물류비 - 마케팅비 - 플랫폼수수료 - 기타)
    actual_operating_profit NUMERIC(15,2) GENERATED ALWAYS AS (
          actual_revenue
          - actual_cogs
          - actual_logistics
          - actual_marketing
          - actual_platform_fee
          - actual_other_cost
      ) STORED,

    -- 달성률
    revenue_achievement_rate NUMERIC(5,2) GENERATED ALWAYS AS (
          CASE WHEN target_revenue = 0 THEN 0
               ELSE ROUND((actual_revenue / target_revenue) * 100, 2)
          END
      ) STORED,

    promo_start_date    DATE NOT NULL,
      promo_end_date      DATE NOT NULL,
      submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_synced_at      TIMESTAMPTZ,               -- 실적 마지막 동기화 시각
    memo                TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

CREATE INDEX IF NOT EXISTS idx_ph_company_channel
    ON promotion_history (company_id, channel, promo_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_ph_company_form
    ON promotion_history (company_id, form_id);

CREATE INDEX IF NOT EXISTS idx_ph_promo_period
    ON promotion_history (company_id, promo_start_date, promo_end_date);
