-- ============================================================
-- V13 : Add auth/collection update timestamps to integration settings
-- ============================================================

ALTER TABLE integration_settings
    ADD COLUMN IF NOT EXISTS auth_updated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS collection_updated_at TIMESTAMP;

UPDATE integration_settings
SET auth_updated_at = COALESCE(auth_updated_at, updated_at)
WHERE auth_updated_at IS NULL;

UPDATE integration_settings
SET collection_updated_at = COALESCE(collection_updated_at, updated_at)
WHERE integration_type = 'PLAYAUTO'
  AND collection_updated_at IS NULL;
