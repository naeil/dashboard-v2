ALTER TABLE product_outbound
ADD COLUMN IF NOT EXISTS outbound_accum_snapshot INTEGER NOT NULL DEFAULT 0;
