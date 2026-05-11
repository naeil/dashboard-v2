UPDATE product
SET product_price = COALESCE(product_price, 0),
    cost_price = COALESCE(cost_price, 0),
    supply_price = COALESCE(supply_price, 0);

ALTER TABLE product
ALTER COLUMN product_price SET DEFAULT 0,
ALTER COLUMN cost_price SET DEFAULT 0,
ALTER COLUMN supply_price SET DEFAULT 0;

ALTER TABLE product
ALTER COLUMN product_price SET NOT NULL,
ALTER COLUMN cost_price SET NOT NULL,
ALTER COLUMN supply_price SET NOT NULL;
