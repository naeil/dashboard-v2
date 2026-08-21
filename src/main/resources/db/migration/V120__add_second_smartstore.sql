-- V120: 스마트스토어 2번째 계정 (국민한상) — 계정별 분리 수집
INSERT INTO channel_api_credentials (channel_type) VALUES ('SMARTSTORE_2') ON CONFLICT (channel_type) DO NOTHING;
COMMENT ON COLUMN channel_api_credentials.channel_type IS 'SMARTSTORE(하이프리), SMARTSTORE_2(국민한상), COUPANG, IMWEB, ELEVENST';
