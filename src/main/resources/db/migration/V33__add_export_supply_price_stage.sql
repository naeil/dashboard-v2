ALTER TABLE executive_export_supply_price
    ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(60) NOT NULL DEFAULT '협의중';
