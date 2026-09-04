-- V140: 휴가·연차 관리 — 신청 → 승인(인사담당자/대표) → 잔여 차감
CREATE TABLE IF NOT EXISTS leave_request (
    id             BIGSERIAL PRIMARY KEY,
    company_id     BIGINT NOT NULL DEFAULT 1,
    username       VARCHAR(80) NOT NULL,
    display_name   VARCHAR(80),
    department     VARCHAR(80),
    leave_type     VARCHAR(30) NOT NULL DEFAULT '연차',   -- 연차/반차/병가/경조사/기타
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    days           NUMERIC(4,1) NOT NULL DEFAULT 1,        -- 사용 일수(반차 0.5)
    reason         VARCHAR(300),
    status         VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED/APPROVED/REJECTED
    approver_username VARCHAR(80),
    approver_name  VARCHAR(80),
    review_comment VARCHAR(300),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leave_request_user ON leave_request(company_id, username, status);
CREATE INDEX IF NOT EXISTS idx_leave_request_status ON leave_request(company_id, status, start_date);
