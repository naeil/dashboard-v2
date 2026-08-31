-- V135: 구글 캘린더 연동 — 사용자별 비공개 iCal 주소(.ics)를 등록하면 내 업무 메모에 실시간 표시
CREATE TABLE IF NOT EXISTS personal_gcal_link (
    company_id BIGINT NOT NULL DEFAULT 1,
    username   VARCHAR(80) NOT NULL,
    ics_url    VARCHAR(600) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, username)
);
