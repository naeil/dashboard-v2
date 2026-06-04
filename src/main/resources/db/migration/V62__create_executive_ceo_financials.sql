CREATE TABLE IF NOT EXISTS executive_ceo_financials (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT       NOT NULL UNIQUE,
    -- 현금/부채
    cash_balance         DECIMAL(15,0) NOT NULL DEFAULT 0,   -- 법인 보유 현금
    total_debt           DECIMAL(15,0) NOT NULL DEFAULT 0,   -- 총 부채
    loan_balance         DECIMAL(15,0) NOT NULL DEFAULT 0,   -- 대출 잔액
    -- 월 고정비 항목
    fixed_office         DECIMAL(15,0) NOT NULL DEFAULT 0,   -- 사무실 임대
    fixed_utility        DECIMAL(15,0) NOT NULL DEFAULT 0,   -- 관리비
    fixed_payroll        DECIMAL(15,0) NOT NULL DEFAULT 0,   -- 인건비
    fixed_ad             DECIMAL(15,0) NOT NULL DEFAULT 0,   -- 광고비
    fixed_rental         DECIMAL(15,0) NOT NULL DEFAULT 0,   -- 렌탈비
    fixed_vehicle        DECIMAL(15,0) NOT NULL DEFAULT 0,   -- 차량
    fixed_telecom        DECIMAL(15,0) NOT NULL DEFAULT 0,   -- 통신비
    fixed_etc            DECIMAL(15,0) NOT NULL DEFAULT 0,   -- 기타 고정비
    -- 사업 목표 (월 단위, 만원)
    goal_consulting      DECIMAL(15,0) NOT NULL DEFAULT 30000000,  -- 컨설팅 목표 3,000만
    goal_online          DECIMAL(15,0) NOT NULL DEFAULT 50000000,  -- 단백깡 목표 5,000만
    goal_export          DECIMAL(15,0) NOT NULL DEFAULT 20000000,  -- 수출 목표 2,000만
    updated_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

INSERT INTO executive_ceo_financials (company_id)
VALUES (1)
ON CONFLICT (company_id) DO NOTHING;
