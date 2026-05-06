-- ============================================================
-- V7 : Add Default Shop
-- ============================================================

INSERT INTO shop (company_id, shop_name, shop_code, platform, created_at)
SELECT c.id, '직접입력', 'A000', 'OTHER', NOW()
FROM company c
WHERE NOT EXISTS (
    SELECT 1
    FROM shop s
    WHERE s.company_id = c.id
      AND s.shop_code = 'A000'
);
