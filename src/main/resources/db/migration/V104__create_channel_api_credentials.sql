-- V104: Create channel API credentials table for SmartStore, Coupang, Imweb integration
CREATE TABLE IF NOT EXISTS channel_api_credentials (
    id BIGSERIAL PRIMARY KEY,
    channel_type VARCHAR(50) NOT NULL UNIQUE,
    credential_key1 TEXT,
    credential_key2 TEXT,
    credential_key3 TEXT,
    credential_key4 TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(50),
    last_sync_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN channel_api_credentials.channel_type IS 'SMARTSTORE, COUPANG, IMWEB';
COMMENT ON COLUMN channel_api_credentials.credential_key1 IS 'SmartStore: clientId / Coupang: accessKey / Imweb: apiKey';
COMMENT ON COLUMN channel_api_credentials.credential_key2 IS 'SmartStore: clientSecret / Coupang: secretKey';
COMMENT ON COLUMN channel_api_credentials.credential_key3 IS 'Reserved';
COMMENT ON COLUMN channel_api_credentials.credential_key4 IS 'Reserved';

INSERT INTO channel_api_credentials (channel_type) VALUES ('SMARTSTORE') ON CONFLICT (channel_type) DO NOTHING;
INSERT INTO channel_api_credentials (channel_type) VALUES ('COUPANG') ON CONFLICT (channel_type) DO NOTHING;
INSERT INTO channel_api_credentials (channel_type) VALUES ('IMWEB') ON CONFLICT (channel_type) DO NOTHING;

-- Add sync_source column to online_channel_performance to track data origin
ALTER TABLE online_channel_performance ADD COLUMN IF NOT EXISTS sync_source VARCHAR(50) DEFAULT 'MANUAL';
COMMENT ON COLUMN online_channel_performance.sync_source IS 'MANUAL, SMARTSTORE, COUPANG, IMWEB';
