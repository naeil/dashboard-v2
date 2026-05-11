-- ============================================================
-- V20 : Ensure Default Company
-- ============================================================

INSERT INTO company (id, name, status, created_at)
SELECT 1, 'Default Company', 'ACTIVE', NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM company
    WHERE id = 1
);

SELECT setval(
    'company_id_seq',
    GREATEST(
        COALESCE((SELECT MAX(id) FROM company), 0),
        1
    )
);
