-- V145: 관제실 '실무진 판단 필요' 카드의 판단 기록 (승인·진행 중·보류·거절 + 사유·다음 단계). 판단할 때마다 한 줄씩 쌓고 최신 줄이 현재 상태.
CREATE TABLE IF NOT EXISTS staff_decision (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL DEFAULT 1,
    item_key        VARCHAR(300) NOT NULL,                 -- 카드 식별자(종류|업체)
    kind            VARCHAR(60),                           -- 회신 답장 / 공구 조건 판단 / 2차 공장 …
    partner_name    VARCHAR(200) NOT NULL,
    partner_email   VARCHAR(200),
    owner_name      VARCHAR(100),
    status          VARCHAR(20) NOT NULL,                  -- APPROVED/RUNNING/HOLD/REJECTED
    reason          TEXT,                                  -- 보류·거절 사유, 승인·진행 메모
    next_steps      TEXT,                                  -- 다음 단계(줄바꿈 구분)
    details         TEXT,                                  -- 공구 수수료율·기간 등 추가 입력
    decided_by      VARCHAR(100),
    decided_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    contact_log_id  BIGINT
);
CREATE INDEX IF NOT EXISTS idx_staff_decision_key ON staff_decision(company_id, item_key, decided_at DESC);
