CREATE TABLE IF NOT EXISTS position_permission_template (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL DEFAULT 1,
    position_name VARCHAR(80) NOT NULL,
    permission_group_name VARCHAR(120),
    description TEXT,
    permission_payload TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_position_permission_template UNIQUE (company_id, position_name)
);

INSERT INTO position_permission_template (
    company_id,
    position_name,
    permission_group_name,
    description,
    permission_payload
)
SELECT
    1,
    position_name,
    position_name || ' 권한',
    position_name || ' 직급의 기능 권한과 메뉴 접근 범위를 관리합니다.',
    COALESCE(
        MIN(allowed_menu_sections) FILTER (
            WHERE allowed_menu_sections IS NOT NULL AND allowed_menu_sections <> ''
        ),
        '[]'
    )
FROM (
    SELECT COALESCE(NULLIF(position_name, ''), '직원') AS position_name, allowed_menu_sections
    FROM dashboard_user
    UNION ALL
    SELECT COALESCE(NULLIF(position_name, ''), '직원') AS position_name, NULL AS allowed_menu_sections
    FROM dashboard_user_invite
) source
WHERE position_name IS NOT NULL AND position_name <> ''
GROUP BY position_name
ON CONFLICT (company_id, position_name) DO NOTHING;
