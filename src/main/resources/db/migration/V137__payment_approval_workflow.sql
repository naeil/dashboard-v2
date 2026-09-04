-- V137: 지출결의 전자결재 — 다우오피스식 양식 필드 + 다단계 결재선 + 알림 + 결재이력
-- 기안자 → 1차 승인자 → 2차 최종 승인자, 금액별 전결(100만원 이하 1차 전결).

-- 1) 지출결의서 양식 필드 + 결재선
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS title            VARCHAR(200);
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS expense_item1    VARCHAR(200);
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS expense_item2    VARCHAR(200);
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS pay_method       VARCHAR(30);   -- 계좌이체/카드결제/선결제/기타
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS pay_bank         VARCHAR(80);
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS account_holder   VARCHAR(80);
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS account_number   VARCHAR(80);

ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS approver1_username VARCHAR(80);
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS approver1_name     VARCHAR(80);
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS approver2_username VARCHAR(80);
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS approver2_name     VARCHAR(80);
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS required_steps     INTEGER NOT NULL DEFAULT 1; -- 금액별 전결로 1 또는 2
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS current_step       INTEGER NOT NULL DEFAULT 0; -- 완료한 결재 단계 수

-- 2) 결재 이력 (감사용)
CREATE TABLE IF NOT EXISTS payment_approval_step (
    id                BIGSERIAL PRIMARY KEY,
    company_id        BIGINT NOT NULL DEFAULT 1,
    request_id        BIGINT NOT NULL REFERENCES executive_payment_request(id) ON DELETE CASCADE,
    step_no           INTEGER NOT NULL,
    approver_username VARCHAR(80) NOT NULL,
    approver_name     VARCHAR(80),
    action            VARCHAR(20) NOT NULL,   -- APPROVE / REJECT
    comment           VARCHAR(500),
    acted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_approval_step_request ON payment_approval_step(request_id);

-- 3) 인앱 알림
CREATE TABLE IF NOT EXISTS user_notification (
    id                 BIGSERIAL PRIMARY KEY,
    company_id         BIGINT NOT NULL DEFAULT 1,
    recipient_username VARCHAR(80) NOT NULL,
    type               VARCHAR(40) NOT NULL,   -- PAYMENT_APPROVAL_REQUEST / PAYMENT_APPROVED / PAYMENT_REJECTED / PAYMENT_STEP1
    title              VARCHAR(200) NOT NULL,
    body               VARCHAR(500),
    link_page          VARCHAR(60),            -- 프론트 메뉴 id (예: payment-approval)
    ref_id             BIGINT,                 -- 관련 지출결의 id
    is_read            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_notification_inbox
    ON user_notification(company_id, recipient_username, is_read, created_at DESC);
