-- V146: AI 공동구매 화면 공용 설정 — 공급가 기준표, 업무 절차 담당·완료, 확정 필요 항목 (값은 JSON 문자열)
CREATE TABLE IF NOT EXISTS group_buy_setting (
    company_id   BIGINT NOT NULL DEFAULT 1,
    setting_key  VARCHAR(60) NOT NULL,
    value        TEXT NOT NULL,
    updated_by   VARCHAR(100),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, setting_key)
);
