-- V134: 내 업무 메모 — 실무자 개인 주간 캘린더 메모 + 자유 메모장
CREATE TABLE IF NOT EXISTS personal_task_memo (
    id         BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL DEFAULT 1,
    username   VARCHAR(80) NOT NULL,
    memo_date  DATE NOT NULL,
    start_time TIME,                        -- 없으면 시간 미지정 메모
    end_time   TIME,
    content    VARCHAR(500) NOT NULL,
    is_done    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ptm_user_date ON personal_task_memo (company_id, username, memo_date);

CREATE TABLE IF NOT EXISTS personal_note (
    company_id BIGINT NOT NULL DEFAULT 1,
    username   VARCHAR(80) NOT NULL,
    content    TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, username)
);
