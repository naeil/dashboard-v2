-- V121: 프로모션 마진/행사 설계 v2 — 행사 1:N 상품블록 1:N 옵션 구조 (기능정의서 v1.0)
-- 기존 promotion_margin_form/promotion_history 는 유지(참고용), 신규 화면은 아래 테이블 사용

CREATE TABLE IF NOT EXISTS promo_event (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL DEFAULT 1,
    brand_name          VARCHAR(80)  NOT NULL,
    channel_name        VARCHAR(80)  NOT NULL,
    title               VARCHAR(200) NOT NULL,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    promo_type          VARCHAR(30),                          -- 할인/증정/할인+증정/노출형
    is_always_on        BOOLEAN NOT NULL DEFAULT FALSE,
    status              VARCHAR(20) NOT NULL DEFAULT '기획',   -- 기획/진행중/종료/취소
    fee_rate            NUMERIC(6,3) NOT NULL DEFAULT 0,      -- % 단위
    ad_rate             NUMERIC(6,3) NOT NULL DEFAULT 0,
    sga_rate            NUMERIC(6,3) NOT NULL DEFAULT 0,
    shipping_cost       INTEGER NOT NULL DEFAULT 0,           -- 무료배송 시 실원가 가산 배송단가
    fixed_cost          BIGINT  NOT NULL DEFAULT 0,           -- 행사 고정비 (필수 입력 유도)
    target_margin_rate  NUMERIC(6,3) NOT NULL DEFAULT 20,     -- 신호등 기준 %
    expected_orders     INTEGER NOT NULL DEFAULT 0,           -- 행사 예상 총주문수
    created_by          VARCHAR(80),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promo_event_period ON promo_event (company_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promo_event_channel ON promo_event (company_id, channel_name);

CREATE TABLE IF NOT EXISTS promo_block (
    id            BIGSERIAL PRIMARY KEY,
    event_id      BIGINT NOT NULL REFERENCES promo_event(id) ON DELETE CASCADE,
    product_code  VARCHAR(100) NOT NULL,
    product_name  VARCHAR(200),
    sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_promo_block_event ON promo_block (event_id);

CREATE TABLE IF NOT EXISTS promo_option (
    id                    BIGSERIAL PRIMARY KEY,
    block_id              BIGINT NOT NULL REFERENCES promo_block(id) ON DELETE CASCADE,
    option_name           VARCHAR(200) NOT NULL,
    unit_cost             BIGINT NOT NULL DEFAULT 0,          -- 마스터 참조값, 수정 시 행사 한정 override
    unit_cost_overridden  BOOLEAN NOT NULL DEFAULT FALSE,     -- override 이력 (사후 정산 검증용)
    master_unit_cost      BIGINT,                             -- 참조 시점의 마스터 원가 (override 대조용)
    list_price            BIGINT NOT NULL DEFAULT 0,          -- 정상가 (세전 통일)
    benefit               JSONB  NOT NULL DEFAULT '{}'::jsonb, -- 할인/쿠폰/증정/배송 레이어
    mix_rate              NUMERIC(6,3) NOT NULL DEFAULT 0,    -- % 단위, 행사 합계 100 검증
    sort_order            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_promo_option_block ON promo_option (block_id);

-- 채널 선택 시 비용조건 기본값 주입용
CREATE TABLE IF NOT EXISTS promo_channel_default (
    channel_name  VARCHAR(80) PRIMARY KEY,
    fee_rate      NUMERIC(6,3) NOT NULL DEFAULT 0,
    ad_rate       NUMERIC(6,3) NOT NULL DEFAULT 0,
    sga_rate      NUMERIC(6,3) NOT NULL DEFAULT 0,
    shipping_cost INTEGER NOT NULL DEFAULT 3500
);
INSERT INTO promo_channel_default (channel_name, fee_rate, ad_rate, sga_rate, shipping_cost) VALUES
    ('스마트스토어', 6, 15, 4, 3500),
    ('쿠팡', 10.8, 15, 4, 0),
    ('카카오톡 스토어', 10, 10, 4, 3500),
    ('11번가', 13, 10, 4, 3500),
    ('자사몰', 3.5, 20, 4, 3500),
    ('오프라인', 0, 0, 4, 0)
ON CONFLICT (channel_name) DO NOTHING;
