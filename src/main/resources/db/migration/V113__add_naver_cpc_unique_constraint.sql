-- V113: naver_cpc_daily_stats 테이블에 unique constraint 추가
-- NaverAdSyncService의 ON CONFLICT upsert를 위해 필요합니다.

-- 중복 데이터 제거 (혹시 있을 경우)
DELETE FROM naver_cpc_daily_stats a
USING naver_cpc_daily_stats b
WHERE a.id < b.id
  AND a.date = b.date
  AND a.ad_type = b.ad_type
  AND a.campaign_name = b.campaign_name
  AND COALESCE(a.ad_group_name, '-') = COALESCE(b.ad_group_name, '-')
  AND COALESCE(a.keyword, '-') = COALESCE(b.keyword, '-');

-- NULL 값을 '-' 로 정규화
UPDATE naver_cpc_daily_stats
SET ad_group_name = '-'
WHERE ad_group_name IS NULL OR ad_group_name = '';

UPDATE naver_cpc_daily_stats
SET keyword = '-'
WHERE keyword IS NULL OR keyword = '';

-- Unique constraint 추가
ALTER TABLE naver_cpc_daily_stats
    ADD CONSTRAINT uq_naver_cpc_daily_stats
        UNIQUE (date, ad_type, campaign_name, ad_group_name, keyword);
