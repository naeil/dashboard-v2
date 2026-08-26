-- V125: 공헌이익 v3 — 월별 광고비 + 택배 단가 설정
CREATE TABLE IF NOT EXISTS ad_spend_monthly (
    id           BIGSERIAL PRIMARY KEY,
    company_id   BIGINT NOT NULL DEFAULT 1,
    period_month VARCHAR(7)   NOT NULL,          -- YYYY-MM
    channel_name VARCHAR(120) NOT NULL,          -- 채널 표시명 (미매칭 시 공통 차감)
    amount       BIGINT NOT NULL DEFAULT 0,
    memo         VARCHAR(200),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ad_spend_monthly UNIQUE (company_id, period_month, channel_name)
);
CREATE INDEX IF NOT EXISTS idx_ad_spend_monthly_month ON ad_spend_monthly (company_id, period_month);

-- 물류비: 건당 택배·포장 단가 (공헌이익 계산용)
ALTER TABLE incentive_config ADD COLUMN IF NOT EXISTS parcel_unit_cost BIGINT NOT NULL DEFAULT 3000;
