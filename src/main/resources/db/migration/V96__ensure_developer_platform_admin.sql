WITH platform_admin AS (
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
    platform_admin.password_hash,
    'ACTIVE',
    NULL
FROM company
CROSS JOIN platform_admin
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
