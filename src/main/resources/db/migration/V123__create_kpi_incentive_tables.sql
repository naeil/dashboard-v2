-- V123: KPI·성과급 시스템 — 목표/설정/담당 매핑
CREATE TABLE IF NOT EXISTS kpi_target (
    id            BIGSERIAL PRIMARY KEY,
    company_id    BIGINT NOT NULL DEFAULT 1,
    period_month  VARCHAR(7)  NOT NULL,              -- YYYY-MM
    team_name     VARCHAR(80) NOT NULL,
    assignee_name VARCHAR(80) NOT NULL DEFAULT '',   -- '' = 팀 목표
    target_sales  BIGINT NOT NULL DEFAULT 0,
    memo          VARCHAR(200),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_kpi_target UNIQUE (company_id, period_month, team_name, assignee_name)
);
CREATE INDEX IF NOT EXISTS idx_kpi_target_month ON kpi_target (company_id, period_month);

-- 성과급 규칙 (반기 기준, 화면에서 수정)
CREATE TABLE IF NOT EXISTS incentive_config (
    company_id     BIGINT PRIMARY KEY,
    half_threshold BIGINT      NOT NULL DEFAULT 18000000,  -- 반기 영업이익 기준액
    pool_rate      NUMERIC(6,3) NOT NULL DEFAULT 10,       -- 초과분 % → 풀
    team_ratio     NUMERIC(6,3) NOT NULL DEFAULT 50,       -- 팀 배분 비중 % (나머지 = 개인)
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO incentive_config (company_id) VALUES (1) ON CONFLICT (company_id) DO NOTHING;

-- 채널 → 팀/담당자 매핑 (온라인 채널·오프라인 거래처 공통)
CREATE TABLE IF NOT EXISTS performance_assignment (
    id            BIGSERIAL PRIMARY KEY,
    company_id    BIGINT NOT NULL DEFAULT 1,
    channel_name  VARCHAR(120) NOT NULL,
    team_name     VARCHAR(80)  NOT NULL DEFAULT '미배정',
    assignee_name VARCHAR(80),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_performance_assignment UNIQUE (company_id, channel_name)
);

-- 기본 팀 매핑 시드
INSERT INTO performance_assignment (company_id, channel_name, team_name) VALUES
    (1, '스마트스토어(하이프리)', '온라인'),
    (1, '스마트스토어(국민한상)', '온라인'),
    (1, '쿠팡', '온라인'),
    (1, '카카오톡 스토어', '온라인'),
    (1, '자사몰', '온라인'),
    (1, '지마켓', '온라인'),
    (1, '옥션', '온라인'),
    (1, '11번가', '온라인'),
    (1, 'NS홈쇼핑', '온라인'),
    (1, '토스', '온라인'),
    (1, '제로스토어', '오프라인 영업'),
    (1, '제로연구소', '오프라인 영업'),
    (1, '제로초이스', '오프라인 영업'),
    (1, '제로데이', '오프라인 영업'),
    (1, '오프라인(냉장)', '오프라인 영업'),
    (1, '위탁판매', '오프라인 영업'),
    (1, '계좌이체(B2B)', '오프라인 영업')
ON CONFLICT (company_id, channel_name) DO NOTHING;
