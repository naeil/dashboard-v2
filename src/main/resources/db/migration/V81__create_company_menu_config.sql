-- 회사별 메뉴 커스텀 설정 (이름 수정, 숨기기, 비공개, 삭제)
CREATE TABLE IF NOT EXISTS company_menu_config (
    company_id  BIGINT PRIMARY KEY,
    config      JSONB NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
