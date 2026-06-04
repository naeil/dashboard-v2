-- 수익 구조 분석: 채널별 제품 계획 저장 (localStorage → DB)
CREATE TABLE executive_profit_plan (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES company(id),
    plan_month  DATE NOT NULL,                        -- 해당 월 (항상 1일로 저장)
    channel     VARCHAR(20) NOT NULL,                 -- 'online' | 'offline' | 'export' | 'consulting'
    product_name VARCHAR(160) NOT NULL,
    sale_price  NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cogs        NUMERIC(15, 2) NOT NULL DEFAULT 0,
    logistics_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    marketing_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    other_cost  NUMERIC(15, 2) NOT NULL DEFAULT 0,
    planned_qty INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profit_plan_company_month
    ON executive_profit_plan (company_id, plan_month);
