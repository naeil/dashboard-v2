-- V141: AI 에이전트 활동 패널 — 회사 PC 에이전트가 하는 일 · 승인 대기 · 생존 신호
CREATE TABLE IF NOT EXISTS agent_activity (
    id               BIGSERIAL PRIMARY KEY,
    company_id       BIGINT NOT NULL DEFAULT 1,
    agent_name       VARCHAR(60) NOT NULL,
    kind             VARCHAR(20) NOT NULL DEFAULT 'TASK',     -- TASK/APPROVAL/ALERT/REPORT
    title            VARCHAR(200) NOT NULL,
    detail           TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'RUNNING',  -- RUNNING/DONE/FAILED/PENDING_APPROVAL/APPROVED/REJECTED
    result           TEXT,
    link_url         VARCHAR(500),
    decided_by       VARCHAR(80),
    decided_at       TIMESTAMPTZ,
    decision_comment VARCHAR(300),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_activity_recent ON agent_activity(company_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_activity_status ON agent_activity(company_id, status);

CREATE TABLE IF NOT EXISTS agent_heartbeat (
    company_id   BIGINT NOT NULL DEFAULT 1,
    agent_name   VARCHAR(60) NOT NULL,
    status_text  VARCHAR(200),
    host         VARCHAR(100),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, agent_name)
);
