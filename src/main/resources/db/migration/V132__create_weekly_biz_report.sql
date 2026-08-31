-- V132: 주간 업무 보고 — 월요일 회의 후 실무자가 보고 파일 등록, AI가 현황 분석
CREATE TABLE IF NOT EXISTS weekly_biz_report (
    id             BIGSERIAL PRIMARY KEY,
    company_id     BIGINT NOT NULL DEFAULT 1,
    week_start     DATE NOT NULL,                -- 해당 주 월요일
    title          VARCHAR(300) NOT NULL,
    file_name      VARCHAR(300),
    raw_text       TEXT NOT NULL,                -- 파일에서 추출한 본문
    uploaded_by    VARCHAR(80),
    uploader_name  VARCHAR(120),
    ai_summary     TEXT,                         -- AI 분석 결과 (블록 포맷)
    ai_model       VARCHAR(80),
    ai_analyzed_at TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weekly_biz_week ON weekly_biz_report (company_id, week_start DESC);
