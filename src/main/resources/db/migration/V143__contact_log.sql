-- V143: 상담·미팅 기록 — 영업 담당자의 거래처 전화 상담·줌·대면 미팅 내용, 합의 사항, 다음 할 일
CREATE TABLE IF NOT EXISTS contact_log (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL DEFAULT 1,
    partner_name    VARCHAR(200) NOT NULL,                  -- 거래처/상대
    contact_type    VARCHAR(20) NOT NULL,                   -- PHONE/ZOOM/MEETING/OTHER
    occurred_at     TIMESTAMPTZ NOT NULL,
    staff_name      VARCHAR(100),                           -- 우리 담당자
    attendees       TEXT,                                   -- 상대 참석자·직함
    summary         TEXT NOT NULL,                          -- 논의 내용
    agreements      TEXT,                                   -- 합의 사항
    next_action     TEXT,                                   -- 다음 할 일
    next_due        DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN',    -- OPEN/DONE
    related_task_id BIGINT,                                 -- 업무(executive_work_task)로 등록한 경우
    source          VARCHAR(20) NOT NULL DEFAULT 'MANUAL',  -- MANUAL/AGENT
    created_by      VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_log_occurred ON contact_log(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_log_partner ON contact_log(company_id, partner_name);
CREATE INDEX IF NOT EXISTS idx_contact_log_status ON contact_log(company_id, status);
