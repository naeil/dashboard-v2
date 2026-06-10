-- V79: 직원 AI 성과 분석 테이블 생성
CREATE TABLE IF NOT EXISTS employee_ai_analysis (
    id             BIGSERIAL PRIMARY KEY,
    company_id     BIGINT NOT NULL REFERENCES company(id),
    username       VARCHAR(80) NOT NULL,
    display_name   VARCHAR(120),

    -- AI 분석 결과 (JSON 텍스트)
    strengths      TEXT,          -- ✅ 강점
    weaknesses     TEXT,          -- ⚠️ 약점
    issues         TEXT,          -- 🔴 문제점
    improvements   TEXT,          -- 💡 개선 방향

    -- 분석 당시 데이터 스냅샷 (디버깅/이력용)
    raw_data       TEXT,

    -- 대표 피드백
    ceo_feedback   TEXT,
    feedback_by    VARCHAR(80),
    feedback_at    TIMESTAMPTZ,

    analyzed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_ai_analysis_company_user
    ON employee_ai_analysis(company_id, username, analyzed_at DESC);
