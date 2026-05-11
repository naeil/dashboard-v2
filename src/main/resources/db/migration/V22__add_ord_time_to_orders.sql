ALTER TABLE orders
ADD COLUMN IF NOT EXISTS ord_time TIMESTAMPTZ;

UPDATE orders
SET ord_time = wdate
WHERE ord_time IS NULL
  AND wdate IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_company_ord_time_brand
ON orders (company_id, ord_time, brand_id);
