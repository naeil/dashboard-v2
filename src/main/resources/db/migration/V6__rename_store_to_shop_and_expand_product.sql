-- ============================================================
-- V6 : Rename Store to Shop and Expand Product
-- ============================================================

-- 1. Rename store to shop
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'store'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'shop'
    ) THEN
        EXECUTE 'ALTER TABLE store RENAME TO shop';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'shop'
          AND column_name = 'store_name'
    ) THEN
        EXECUTE 'ALTER TABLE shop RENAME COLUMN store_name TO shop_name';
    END IF;
END $$;

ALTER TABLE shop ADD COLUMN IF NOT EXISTS shop_code VARCHAR(100);
UPDATE shop
SET shop_code = CONCAT('S', LPAD(id::text, 3, '0'))
WHERE shop_code IS NULL;
ALTER TABLE shop ALTER COLUMN shop_code SET NOT NULL;

-- 2. Update references in other tables
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'daily_sales_stats'
          AND column_name = 'store_id'
    ) THEN
        EXECUTE 'ALTER TABLE daily_sales_stats RENAME COLUMN store_id TO shop_id';
    END IF;
END $$;

-- 3. Expand Product Table
-- V5 added sku_cd. Now add prod_no (ori_prod_no or prod_no from PlayAuto).
ALTER TABLE product ADD COLUMN IF NOT EXISTS prod_no BIGINT;
-- Ensure uniqueness for (company_id, sku_cd) and (company_id, prod_no)
ALTER TABLE product DROP CONSTRAINT IF EXISTS uq_product_sku;
ALTER TABLE product ADD CONSTRAINT uq_product_sku UNIQUE (company_id, sku_cd);
ALTER TABLE product ADD CONSTRAINT uq_product_prod_no UNIQUE (company_id, prod_no);

-- 4. Update daily_sales_stats references
-- already renamed in step 2.

-- 5. Fix indices
DROP INDEX IF EXISTS idx_sales_company_date_store;
CREATE INDEX idx_sales_company_date_shop ON daily_sales_stats (company_id, date, shop_id);
