-- V147: 로그인 알림 — 나에게 온 업무 지시·피드백, 새로 배정된 업무를 '확인'했는지 기록
CREATE TABLE IF NOT EXISTS user_notice_seen (
    company_id  BIGINT NOT NULL DEFAULT 1,
    username    VARCHAR(100) NOT NULL,
    item_type   VARCHAR(20) NOT NULL,     -- FEEDBACK / TASK
    item_id     BIGINT NOT NULL,
    seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, username, item_type, item_id)
);
