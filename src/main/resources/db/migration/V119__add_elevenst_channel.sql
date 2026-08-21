-- V119: 11번가 채널 자격증명 행 추가 (직연동 확대)
INSERT INTO channel_api_credentials (channel_type) VALUES ('ELEVENST') ON CONFLICT (channel_type) DO NOTHING;
COMMENT ON COLUMN channel_api_credentials.channel_type IS 'SMARTSTORE, COUPANG, IMWEB, ELEVENST';
COMMENT ON COLUMN channel_api_credentials.credential_key1 IS 'SmartStore: clientId / Coupang: accessKey / Imweb: apiKey / 11st: openApiKey';
COMMENT ON COLUMN channel_api_credentials.credential_key3 IS 'Coupang: vendorId (A로 시작하는 업체코드)';
