CREATE TABLE IF NOT EXISTS ad_api_credentials (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL,
      platform VARCHAR(50) NOT NULL,
      key_name VARCHAR(100) NOT NULL,
      key_value TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(company_id, platform, key_name)
  );

CREATE INDEX IF NOT EXISTS idx_ad_api_credentials_company_platform ON ad_api_credentials(company_id, platform);
