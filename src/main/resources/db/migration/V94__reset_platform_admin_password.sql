ALTER TABLE dashboard_user
    DROP CONSTRAINT IF EXISTS uq_dashboard_user_company_username;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_dashboard_user_company_scope_username'
    ) THEN
        ALTER TABLE dashboard_user
            ADD CONSTRAINT uq_dashboard_user_company_scope_username
            UNIQUE (company_id, account_scope, username);
    END IF;
END;
$$;

INSERT INTO dashboard_user (
    company_id,
    username,
    display_name,
    department,
    position_name,
    role,
    account_scope,
    account_level,
    password_hash,
    status,
    allowed_menu_sections
)
VALUES (
    1,
    'developer1',
    'Developer Platform Admin',
    'Platform',
    'Admin',
    'EXECUTIVE',
    'PLATFORM',
    'ADMIN',
    'pbkdf2$120000$vjRjn+eT+M3FzRu1oBwbRQ==$wfzOm6dM3Gedf7IVcR4+l84fT5meOng7cYFV1R4Kcjo=',
    'ACTIVE',
    NULL
)
ON CONFLICT (company_id, account_scope, username)
DO UPDATE SET
    display_name = EXCLUDED.display_name,
    department = EXCLUDED.department,
    position_name = EXCLUDED.position_name,
    role = EXCLUDED.role,
    account_level = EXCLUDED.account_level,
    password_hash = EXCLUDED.password_hash,
    status = 'ACTIVE',
    allowed_menu_sections = EXCLUDED.allowed_menu_sections,
    updated_at = NOW();
