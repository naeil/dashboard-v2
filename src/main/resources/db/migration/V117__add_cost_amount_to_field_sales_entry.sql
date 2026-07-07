-- Additive-only migration: add a per-row product cost (COGS) column to
-- field_sales_entry so the L0 sales upload can capture cost alongside sales,
-- enabling a more accurate operating profit calculation.
ALTER TABLE field_sales_entry
    ADD COLUMN cost_amount NUMERIC(14, 2) NOT NULL DEFAULT 0;
