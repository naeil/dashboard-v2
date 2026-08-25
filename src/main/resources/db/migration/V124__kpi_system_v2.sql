-- V124: KPI 시스템 v2 — 팀 가중치/정성 평가/마감·확정 스냅샷/지급 대장

-- 팀 정의: 풀 배분 가중치 + 자동점수 비중
CREATE TABLE IF NOT EXISTS kpi_team (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL DEFAULT 1,
    team_name   VARCHAR(80) NOT NULL,
    weight      NUMERIC(6,2) NOT NULL DEFAULT 25,   -- 풀 배분 가중치 (%)
    auto_ratio  NUMERIC(6,2) NOT NULL DEFAULT 70,   -- 자동점수 비중 % (나머지 = 정성)
    sort_order  INT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_kpi_team UNIQUE (company_id, team_name)
);
INSERT INTO kpi_team (company_id, team_name, weight, auto_ratio, sort_order) VALUES
    (1, '온라인', 35, 70, 1),
    (1, '오프라인 영업', 35, 70, 2),
    (1, '운영/물류', 20, 0, 3),
    (1, '마케팅', 10, 0, 4)
ON CONFLICT (company_id, team_name) DO NOTHING;

-- 정성 평가 점수 (period_key: YYYY-MM 또는 YYYY-H1/H2, assignee_name '' = 팀 점수)
CREATE TABLE IF NOT EXISTS kpi_score (
    id            BIGSERIAL PRIMARY KEY,
    company_id    BIGINT NOT NULL DEFAULT 1,
    period_key    VARCHAR(10) NOT NULL,
    team_name     VARCHAR(80) NOT NULL,
    assignee_name VARCHAR(80) NOT NULL DEFAULT '',
    score         NUMERIC(6,2) NOT NULL DEFAULT 100,
    memo          VARCHAR(300),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_kpi_score UNIQUE (company_id, period_key, team_name, assignee_name)
);

-- 마감·확정 스냅샷 (확정 시 계산 근거 payload 보존)
CREATE TABLE IF NOT EXISTS kpi_snapshot (
    id           BIGSERIAL PRIMARY KEY,
    company_id   BIGINT NOT NULL DEFAULT 1,
    period_type  VARCHAR(10) NOT NULL,     -- month | half
    period_key   VARCHAR(10) NOT NULL,     -- 2026-08 | 2026-H2
    status       VARCHAR(12) NOT NULL DEFAULT 'DRAFT',  -- DRAFT | CONFIRMED
    payload      TEXT,                     -- 확정 시점 performance JSON
    total_sales  BIGINT NOT NULL DEFAULT 0,
    total_profit BIGINT NOT NULL DEFAULT 0,
    pool         BIGINT NOT NULL DEFAULT 0,
    memo         VARCHAR(300),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT uq_kpi_snapshot UNIQUE (company_id, period_type, period_key)
);

-- 개인별 지급 대장 (반기 마감안 생성 시 채워지고, 확정 시 잠김)
CREATE TABLE IF NOT EXISTS kpi_payout (
    id            BIGSERIAL PRIMARY KEY,
    snapshot_id   BIGINT NOT NULL REFERENCES kpi_snapshot(id) ON DELETE CASCADE,
    company_id    BIGINT NOT NULL DEFAULT 1,
    period_key    VARCHAR(10) NOT NULL,
    team_name     VARCHAR(80) NOT NULL,
    assignee_name VARCHAR(80) NOT NULL,
    base_amount   BIGINT NOT NULL DEFAULT 0,   -- 시스템 계산액
    adjust_amount BIGINT NOT NULL DEFAULT 0,   -- 대표 조정액 (+/-)
    final_amount  BIGINT NOT NULL DEFAULT 0,   -- 확정 지급액
    reason        VARCHAR(300),                -- 조정 사유
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_kpi_payout UNIQUE (snapshot_id, team_name, assignee_name)
);
CREATE INDEX IF NOT EXISTS idx_kpi_payout_period ON kpi_payout (company_id, period_key);
