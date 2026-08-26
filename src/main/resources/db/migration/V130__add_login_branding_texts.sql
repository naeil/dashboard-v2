-- V130: 로그인 화면 문구 커스텀 — 헤드라인/서브 문구를 관리자가 교체 가능
ALTER TABLE company_branding ADD COLUMN IF NOT EXISTS login_title TEXT;
ALTER TABLE company_branding ADD COLUMN IF NOT EXISTS login_subtitle TEXT;
