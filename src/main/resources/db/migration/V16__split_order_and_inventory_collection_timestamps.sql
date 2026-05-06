ALTER TABLE integration_settings
    ADD COLUMN IF NOT EXISTS last_order_collected_at TIMESTAMPTZ;

ALTER TABLE integration_settings
    ADD COLUMN IF NOT EXISTS last_inventory_collected_at TIMESTAMPTZ;

UPDATE integration_settings
SET last_order_collected_at = COALESCE(last_order_collected_at, last_collected_at),
    last_inventory_collected_at = COALESCE(last_inventory_collected_at, last_collected_at)
WHERE last_collected_at IS NOT NULL;
