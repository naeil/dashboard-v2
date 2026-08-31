-- V133: 팀 관리 — 팀장이 팀원 일일보고에 피드백 코멘트
CREATE TABLE IF NOT EXISTS staff_report_comment (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL DEFAULT 1,
    report_id       BIGINT NOT NULL,
    author_username VARCHAR(80) NOT NULL,
    author_name     VARCHAR(120),
    content         VARCHAR(1000) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_src_report ON staff_report_comment (report_id, id);
