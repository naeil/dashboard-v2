ALTER TABLE dashboard_user
    ADD COLUMN IF NOT EXISTS account_scope VARCHAR(20) NOT NULL DEFAULT 'TENANT';

ALTER TABLE dashboard_user
    ADD COLUMN IF NOT EXISTS account_level VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE';

UPDATE dashboard_user
SET account_scope = CASE
        WHEN username = 'admin' AND role = 'EXECUTIVE' THEN 'PLATFORM'
        ELSE COALESCE(account_scope, 'TENANT')
    END,
    account_level = CASE
        WHEN account_level IS NOT NULL THEN account_level
        WHEN role = 'EXECUTIVE' THEN 'ADMIN'
        WHEN role = 'MANAGER' THEN 'MANAGER'
        ELSE 'EMPLOYEE'
    END
WHERE account_scope IS NULL
   OR account_level IS NULL;

ALTER TABLE dashboard_user
    DROP CONSTRAINT IF EXISTS dashboard_user_username_key;

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

UPDATE company
SET company_code = generate_company_code()
WHERE id <> 1
  AND company_code = 'NVPZ7';

UPDATE company
SET company_code = 'NVPZ7'
WHERE id = 1;

WITH platform_developer AS (
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
        updated_at = NOW()
    RETURNING password_hash
)
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
SELECT
    company.id,
    'developer1',
    'Developer Tenant Admin',
    'Management',
    'Admin',
    'EXECUTIVE',
    'TENANT',
    'ADMIN',
    platform_developer.password_hash,
    'ACTIVE',
    NULL
FROM company
CROSS JOIN platform_developer
WHERE company.company_code = 'NVPZ7'
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
