-- V115: Login screen content management (site notices/updates + login banner image)
-- Purely additive tables. Powers the redesigned login page (banner + notice/update board)
-- and a new "로그인 화면 관리" panel in the platform admin console. Does not modify any
-- existing table.

CREATE TABLE site_notice (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL DEFAULT 1,
    category VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    is_new BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_notice_company_category ON site_notice (company_id, category, created_at);

CREATE TABLE site_login_banner (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    image_data TEXT,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_site_login_banner_company ON site_login_banner (company_id);

INSERT INTO site_notice (company_id, category, title, content, is_new, created_by) VALUES
(1, 'NOTICE', '로그인 화면이 새롭게 개편되었습니다', '공지사항과 업데이트 현황을 로그인 화면에서 바로 확인할 수 있습니다.', TRUE, 'system'),
(1, 'UPDATE', '로그인 화면 관리 기능 추가', '플랫폼 관리자 페이지에서 배너 이미지, 공지사항, 업데이트 항목을 직접 등록/수정/삭제할 수 있습니다.', TRUE, 'system');
