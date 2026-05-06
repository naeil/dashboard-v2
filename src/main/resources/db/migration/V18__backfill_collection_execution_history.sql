INSERT INTO collection_execution_history (
    company_id,
    integration_type,
    job_type,
    status,
    message,
    started_at,
    finished_at
)
SELECT
    company_id,
    integration_type,
    'ORDER',
    'SUCCESS',
    'Backfilled from existing last order collection timestamp',
    last_order_collected_at,
    last_order_collected_at
FROM integration_settings
WHERE last_order_collected_at IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM collection_execution_history history
      WHERE history.company_id = integration_settings.company_id
        AND history.integration_type = integration_settings.integration_type
        AND history.job_type = 'ORDER'
  );

INSERT INTO collection_execution_history (
    company_id,
    integration_type,
    job_type,
    status,
    message,
    started_at,
    finished_at
)
SELECT
    company_id,
    integration_type,
    'INVENTORY',
    'SUCCESS',
    'Backfilled from existing last inventory collection timestamp',
    last_inventory_collected_at,
    last_inventory_collected_at
FROM integration_settings
WHERE last_inventory_collected_at IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM collection_execution_history history
      WHERE history.company_id = integration_settings.company_id
        AND history.integration_type = integration_settings.integration_type
        AND history.job_type = 'INVENTORY'
  );
