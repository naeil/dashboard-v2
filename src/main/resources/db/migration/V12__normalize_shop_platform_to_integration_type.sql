-- ============================================================
-- V12 : Normalize shop platform values to IntegrationType enum names
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'shop'
          AND c.conname = 'store_platform_check'
    ) THEN
        EXECUTE 'ALTER TABLE shop DROP CONSTRAINT store_platform_check';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'shop'
          AND c.conname = 'shop_platform_check'
    ) THEN
        EXECUTE 'ALTER TABLE shop DROP CONSTRAINT shop_platform_check';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'shop'
          AND c.conname = 'chk_shop_platform_integration_type'
    ) THEN
        EXECUTE 'ALTER TABLE shop DROP CONSTRAINT chk_shop_platform_integration_type';
    END IF;
END $$;

UPDATE shop
SET platform = 'OTHER'
WHERE platform IS NULL OR BTRIM(platform) = '';

UPDATE shop
SET platform = 'NAVER_SMARTSTORE'
WHERE platform IN ('SMARTSTORE', 'NAVER', 'NAVER_SMARTSTORE');

UPDATE shop
SET platform = 'COUPANG'
WHERE platform = 'COUPANG';

UPDATE shop
SET platform = 'ELEVEN_STREET'
WHERE platform IN ('ELEVENST', 'ELEVEN_STREET');

UPDATE shop
SET platform = 'AUCTION'
WHERE platform = 'AUCTION';

UPDATE shop
SET platform = 'GMARKET'
WHERE platform = 'GMARKET';

UPDATE shop
SET platform = 'IMWEB'
WHERE platform = 'IMWEB';

UPDATE shop
SET platform = 'KAKAO_TALK_STORE'
WHERE platform IN ('KAKAO', 'KAKAO_TALK_STORE');

UPDATE shop
SET platform = 'OTHER'
WHERE platform = 'META';

UPDATE shop
SET platform = 'LOTTE_ON'
WHERE shop_name ILIKE '%LOTTEON%'
   OR shop_name ILIKE '%LOTTE ON%';

UPDATE shop
SET platform = 'NONGSAN_SHOPPINGMALL'
WHERE shop_name ILIKE '%NONGSAN%';

UPDATE shop
SET platform = 'OTHER'
WHERE platform NOT IN (
    'NAVER_SMARTSTORE',
    'COUPANG',
    'ELEVEN_STREET',
    'AUCTION',
    'GMARKET',
    'KAKAO_TALK_STORE',
    'IMWEB',
    'LOTTE_ON',
    'NONGSAN_SHOPPINGMALL',
    'OTHER'
);

ALTER TABLE shop
    ADD CONSTRAINT chk_shop_platform_integration_type
    CHECK (platform IN (
        'NAVER_SMARTSTORE',
        'COUPANG',
        'ELEVEN_STREET',
        'AUCTION',
        'GMARKET',
        'KAKAO_TALK_STORE',
        'IMWEB',
        'LOTTE_ON',
        'NONGSAN_SHOPPINGMALL',
        'OTHER'
    ));
