ALTER TABLE dashboard_user
    ADD COLUMN IF NOT EXISTS allowed_menu_sections TEXT;
