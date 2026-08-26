-- V129: 로그인 화면 브랜딩 — 관리자가 교체 가능한 로그인 이미지
CREATE TABLE IF NOT EXISTS company_branding (
    company_id  BIGINT PRIMARY KEY,
    login_image TEXT,                 -- data URL (없으면 기본 이미지 사용)
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO company_branding (company_id) VALUES (1) ON CONFLICT (company_id) DO NOTHING;
