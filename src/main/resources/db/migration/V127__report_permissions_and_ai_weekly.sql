-- V127: 업무 보고 열람 권한 + AI 주간 보고
-- A(viewer)가 B(target)의 일일 보고를 볼 수 있게 관리자가 설정 (예: 팀장 → 팀원)
CREATE TABLE IF NOT EXISTS report_view_permission (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL DEFAULT 1,
    viewer_username VARCHAR(80) NOT NULL,
    target_username VARCHAR(80) NOT NULL,
    memo            VARCHAR(200),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_report_view_permission UNIQUE (company_id, viewer_username, target_username)
);
CREATE INDEX IF NOT EXISTS idx_report_view_permission_viewer
    ON report_view_permission (company_id, viewer_username);

-- AI가 일일 보고 7일치를 육하원칙으로 정리한 주간 보고
CREATE TABLE IF NOT EXISTS ai_weekly_report (
    id           BIGSERIAL PRIMARY KEY,
    company_id   BIGINT NOT NULL DEFAULT 1,
    username     VARCHAR(80) NOT NULL,
    display_name VARCHAR(120),
    week_start   DATE NOT NULL,               -- 해당 주 월요일
    content      TEXT NOT NULL,
    source_count INT NOT NULL DEFAULT 0,      -- 근거가 된 일일 보고 수
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ai_weekly_report UNIQUE (company_id, username, week_start)
);
CREATE INDEX IF NOT EXISTS idx_ai_weekly_report_week ON ai_weekly_report (company_id, week_start DESC);
