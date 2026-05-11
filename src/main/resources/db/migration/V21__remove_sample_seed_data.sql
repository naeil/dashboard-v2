-- ============================================================
-- V21 : Remove Historical Sample Seed Data
-- ============================================================

CREATE TEMP TABLE sample_products_to_delete ON COMMIT DROP AS
SELECT id, company_id, brand_id
FROM product
WHERE external_product_id ~ '^PA-(NB|NP|NH|AC|AS|AO|GO|GB|GK)-00[1-4]$';

CREATE TEMP TABLE sample_companies_to_cleanup ON COMMIT DROP AS
SELECT DISTINCT company_id
FROM sample_products_to_delete;

CREATE TEMP TABLE sample_brands_to_cleanup ON COMMIT DROP AS
SELECT DISTINCT brand_id
FROM sample_products_to_delete;

DELETE FROM product_outbound
WHERE product_id IN (SELECT id FROM sample_products_to_delete);

DELETE FROM daily_sales_stats
WHERE product_id IN (SELECT id FROM sample_products_to_delete);

DELETE FROM orders
WHERE product_id IN (SELECT id FROM sample_products_to_delete);

DELETE FROM product
WHERE id IN (SELECT id FROM sample_products_to_delete);

DELETE FROM brand b
WHERE b.id IN (SELECT brand_id FROM sample_brands_to_cleanup)
  AND NOT EXISTS (
      SELECT 1
      FROM product p
      WHERE p.brand_id = b.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM daily_sales_stats d
      WHERE d.brand_id = b.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.brand_id = b.id
  );

DELETE FROM shop s
WHERE s.company_id IN (SELECT company_id FROM sample_companies_to_cleanup)
  AND s.shop_code IN ('S001', 'S002', 'S003', 'S004', 'S005', 'S006', 'S007', 'S008', 'S009')
  AND NOT EXISTS (
      SELECT 1
      FROM daily_sales_stats d
      WHERE d.shop_id = s.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.shop_id = s.id
  );

DELETE FROM company c
WHERE c.id IN (SELECT company_id FROM sample_companies_to_cleanup)
  AND c.id <> 1
  AND NOT EXISTS (
      SELECT 1
      FROM integration_settings i
      WHERE i.company_id = c.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM collection_execution_history h
      WHERE h.company_id = c.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM customer cu
      WHERE cu.company_id = c.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM product_outbound po
      WHERE po.company_id = c.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM daily_sales_stats d
      WHERE d.company_id = c.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.company_id = c.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM product p
      WHERE p.company_id = c.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM brand b
      WHERE b.company_id = c.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM shop s
      WHERE s.company_id = c.id
  );
