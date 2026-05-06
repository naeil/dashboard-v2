-- ============================================================
-- V2 : Sample Data
-- 3 companies × 3 stores × 3 brands × 4 products
-- 90 days of daily sales (2024-01-01 ~ 2024-03-31)
-- ============================================================

-- -------------------------------------------------------
-- Companies
-- -------------------------------------------------------
INSERT INTO company (id, name, status, created_at) VALUES
(1, '내일커머스',  'ACTIVE',   '2023-01-01 00:00:00+09'),
(2, '에이블패션',  'ACTIVE',   '2023-03-15 00:00:00+09'),
(3, '그린라이프',  'INACTIVE', '2023-06-01 00:00:00+09');

SELECT setval('company_id_seq', 3);

-- -------------------------------------------------------
-- Stores  (3 per company = 9 total)
-- -------------------------------------------------------
INSERT INTO store (id, company_id, store_name, platform, created_at) VALUES
-- 내일커머스
(1,  1, '내일 스마트스토어',  'SMARTSTORE', '2023-01-05 00:00:00+09'),
(2,  1, '내일 쿠팡마켓',      'COUPANG',    '2023-01-10 00:00:00+09'),
(3,  1, '내일 네이버쇼핑',    'NAVER',      '2023-02-01 00:00:00+09'),
-- 에이블패션
(4,  2, '에이블 스마트스토어','SMARTSTORE', '2023-03-20 00:00:00+09'),
(5,  2, '에이블 메타광고',    'META',       '2023-04-01 00:00:00+09'),
(6,  2, '에이블 지마켓',      'GMARKET',    '2023-05-01 00:00:00+09'),
-- 그린라이프
(7,  3, '그린 스마트스토어',  'SMARTSTORE', '2023-06-10 00:00:00+09'),
(8,  3, '그린 쿠팡마켓',      'COUPANG',    '2023-07-01 00:00:00+09'),
(9,  3, '그린 카카오',        'KAKAO',      '2023-08-01 00:00:00+09');

SELECT setval('store_id_seq', 9);

-- -------------------------------------------------------
-- Brands  (3 per company = 9 total)
-- -------------------------------------------------------
INSERT INTO brand (id, company_id, brand_name, created_at) VALUES
-- 내일커머스
(1,  1, 'NAEIL BASIC',   '2023-01-05 00:00:00+09'),
(2,  1, 'NAEIL PREMIUM', '2023-01-05 00:00:00+09'),
(3,  1, 'NAEIL HOME',    '2023-02-01 00:00:00+09'),
-- 에이블패션
(4,  2, 'ABLE CLASSIC',  '2023-03-20 00:00:00+09'),
(5,  2, 'ABLE SPORTS',   '2023-04-01 00:00:00+09'),
(6,  2, 'ABLE OUTDOOR',  '2023-05-01 00:00:00+09'),
-- 그린라이프
(7,  3, 'GREEN ORGANIC', '2023-06-10 00:00:00+09'),
(8,  3, 'GREEN BEAUTY',  '2023-07-01 00:00:00+09'),
(9,  3, 'GREEN KITCHEN', '2023-08-01 00:00:00+09');

SELECT setval('brand_id_seq', 9);

-- -------------------------------------------------------
-- Products  (4 per brand = 36 total)
-- -------------------------------------------------------
INSERT INTO product (id, company_id, brand_id, product_name, external_product_id, created_at) VALUES
-- NAEIL BASIC (brand 1)
(1,  1, 1, '베이직 면 티셔츠 화이트',   'PA-NB-001', '2023-01-10 00:00:00+09'),
(2,  1, 1, '베이직 면 티셔츠 블랙',     'PA-NB-002', '2023-01-10 00:00:00+09'),
(3,  1, 1, '베이직 슬랙스 그레이',      'PA-NB-003', '2023-01-15 00:00:00+09'),
(4,  1, 1, '베이직 후드 네이비',        'PA-NB-004', '2023-01-15 00:00:00+09'),
-- NAEIL PREMIUM (brand 2)
(5,  1, 2, '프리미엄 울 코트',          'PA-NP-001', '2023-02-01 00:00:00+09'),
(6,  1, 2, '프리미엄 캐시미어 니트',    'PA-NP-002', '2023-02-01 00:00:00+09'),
(7,  1, 2, '프리미엄 실크 블라우스',    'PA-NP-003', '2023-02-10 00:00:00+09'),
(8,  1, 2, '프리미엄 레더 재킷',        'PA-NP-004', '2023-02-10 00:00:00+09'),
-- NAEIL HOME (brand 3)
(9,  1, 3, '홈 방석 세트',              'PA-NH-001', '2023-03-01 00:00:00+09'),
(10, 1, 3, '홈 침구 세트 킹사이즈',     'PA-NH-002', '2023-03-01 00:00:00+09'),
(11, 1, 3, '홈 커튼 화이트',            'PA-NH-003', '2023-03-05 00:00:00+09'),
(12, 1, 3, '홈 아로마 디퓨저',          'PA-NH-004', '2023-03-05 00:00:00+09'),
-- ABLE CLASSIC (brand 4)
(13, 2, 4, '클래식 정장 셔츠 화이트',   'PA-AC-001', '2023-04-01 00:00:00+09'),
(14, 2, 4, '클래식 정장 셔츠 블루',     'PA-AC-002', '2023-04-01 00:00:00+09'),
(15, 2, 4, '클래식 치노 팬츠 베이지',   'PA-AC-003', '2023-04-05 00:00:00+09'),
(16, 2, 4, '클래식 블레이저 네이비',    'PA-AC-004', '2023-04-05 00:00:00+09'),
-- ABLE SPORTS (brand 5)
(17, 2, 5, '스포츠 러닝화 블랙',        'PA-AS-001', '2023-04-10 00:00:00+09'),
(18, 2, 5, '스포츠 레깅스 그레이',      'PA-AS-002', '2023-04-10 00:00:00+09'),
(19, 2, 5, '스포츠 짚업 후드',          'PA-AS-003', '2023-04-15 00:00:00+09'),
(20, 2, 5, '스포츠 반팔 티셔츠',        'PA-AS-004', '2023-04-15 00:00:00+09'),
-- ABLE OUTDOOR (brand 6)
(21, 2, 6, '아웃도어 등산화',           'PA-AO-001', '2023-05-05 00:00:00+09'),
(22, 2, 6, '아웃도어 방풍 재킷',        'PA-AO-002', '2023-05-05 00:00:00+09'),
(23, 2, 6, '아웃도어 기능성 바지',      'PA-AO-003', '2023-05-10 00:00:00+09'),
(24, 2, 6, '아웃도어 경량 다운',        'PA-AO-004', '2023-05-10 00:00:00+09'),
-- GREEN ORGANIC (brand 7)
(25, 3, 7, '유기농 그린 주스 1L',       'PA-GO-001', '2023-07-01 00:00:00+09'),
(26, 3, 7, '유기농 귀리 그래놀라',      'PA-GO-002', '2023-07-01 00:00:00+09'),
(27, 3, 7, '유기농 아몬드버터',         'PA-GO-003', '2023-07-05 00:00:00+09'),
(28, 3, 7, '유기농 퀴노아 500g',        'PA-GO-004', '2023-07-05 00:00:00+09'),
-- GREEN BEAUTY (brand 8)
(29, 3, 8, '그린 순면 토너패드',        'PA-GB-001', '2023-08-01 00:00:00+09'),
(30, 3, 8, '그린 어성초 스킨케어 세트', 'PA-GB-002', '2023-08-01 00:00:00+09'),
(31, 3, 8, '그린 비타민 세럼',          'PA-GB-003', '2023-08-05 00:00:00+09'),
(32, 3, 8, '그린 수분 크림',            'PA-GB-004', '2023-08-05 00:00:00+09'),
-- GREEN KITCHEN (brand 9)
(33, 3, 9, '키친 대나무 도마 세트',     'PA-GK-001', '2023-09-01 00:00:00+09'),
(34, 3, 9, '키친 무독성 실리콘 주걱',   'PA-GK-002', '2023-09-01 00:00:00+09'),
(35, 3, 9, '키친 옻칠 나무 젓가락',     'PA-GK-003', '2023-09-05 00:00:00+09'),
(36, 3, 9, '키친 친환경 밀밀 그릇',     'PA-GK-004', '2023-09-05 00:00:00+09');

SELECT setval('product_id_seq', 36);

-- -------------------------------------------------------
-- Daily Sales Stats — 90 days (2024-01-01 ~ 2024-03-31)
-- Company 1 (내일커머스): stores 1-3, brands 1-3, products 1-12
-- We insert one row per (store, brand, product) combination per day
-- using generate_series for concise data generation
-- -------------------------------------------------------

-- Company 1 / Store 1 / Brand 1 / Products 1-4
INSERT INTO daily_sales_stats
    (company_id, date, store_id, brand_id, product_id,
     gross_amount, discount_amount, net_revenue, shipping_fee)
SELECT
    1, d, 1, 1, p,
    ROUND((RANDOM() * 800000 + 200000)::numeric, 2),
    ROUND((RANDOM() * 40000  + 10000)::numeric,  2),
    ROUND((RANDOM() * 700000 + 150000)::numeric, 2),
    ROUND((RANDOM() * 5000   + 2500)::numeric,   2)
FROM generate_series('2024-01-01'::date, '2024-03-31'::date, '1 day'::interval) AS d
CROSS JOIN unnest(ARRAY[1,2,3,4]) AS p;

-- Company 1 / Store 2 / Brand 2 / Products 5-8
INSERT INTO daily_sales_stats
    (company_id, date, store_id, brand_id, product_id,
     gross_amount, discount_amount, net_revenue, shipping_fee)
SELECT
    1, d, 2, 2, p,
    ROUND((RANDOM() * 1500000 + 500000)::numeric, 2),
    ROUND((RANDOM() * 80000   + 20000)::numeric,  2),
    ROUND((RANDOM() * 1200000 + 400000)::numeric, 2),
    ROUND((RANDOM() * 8000    + 3000)::numeric,   2)
FROM generate_series('2024-01-01'::date, '2024-03-31'::date, '1 day'::interval) AS d
CROSS JOIN unnest(ARRAY[5,6,7,8]) AS p;

-- Company 1 / Store 3 / Brand 3 / Products 9-12
INSERT INTO daily_sales_stats
    (company_id, date, store_id, brand_id, product_id,
     gross_amount, discount_amount, net_revenue, shipping_fee)
SELECT
    1, d, 3, 3, p,
    ROUND((RANDOM() * 600000 + 100000)::numeric, 2),
    ROUND((RANDOM() * 30000  + 5000)::numeric,   2),
    ROUND((RANDOM() * 550000 + 90000)::numeric,  2),
    ROUND((RANDOM() * 4000   + 2000)::numeric,   2)
FROM generate_series('2024-01-01'::date, '2024-03-31'::date, '1 day'::interval) AS d
CROSS JOIN unnest(ARRAY[9,10,11,12]) AS p;

-- Company 2 / Store 4 / Brand 4 / Products 13-16
INSERT INTO daily_sales_stats
    (company_id, date, store_id, brand_id, product_id,
     gross_amount, discount_amount, net_revenue, shipping_fee)
SELECT
    2, d, 4, 4, p,
    ROUND((RANDOM() * 900000 + 300000)::numeric, 2),
    ROUND((RANDOM() * 50000  + 15000)::numeric,  2),
    ROUND((RANDOM() * 800000 + 250000)::numeric, 2),
    ROUND((RANDOM() * 6000   + 2500)::numeric,   2)
FROM generate_series('2024-01-01'::date, '2024-03-31'::date, '1 day'::interval) AS d
CROSS JOIN unnest(ARRAY[13,14,15,16]) AS p;

-- Company 2 / Store 5 / Brand 5 / Products 17-20
INSERT INTO daily_sales_stats
    (company_id, date, store_id, brand_id, product_id,
     gross_amount, discount_amount, net_revenue, shipping_fee)
SELECT
    2, d, 5, 5, p,
    ROUND((RANDOM() * 700000 + 200000)::numeric, 2),
    ROUND((RANDOM() * 35000  + 10000)::numeric,  2),
    ROUND((RANDOM() * 600000 + 180000)::numeric, 2),
    ROUND((RANDOM() * 5000   + 2000)::numeric,   2)
FROM generate_series('2024-01-01'::date, '2024-03-31'::date, '1 day'::interval) AS d
CROSS JOIN unnest(ARRAY[17,18,19,20]) AS p;

-- Company 2 / Store 6 / Brand 6 / Products 21-24
INSERT INTO daily_sales_stats
    (company_id, date, store_id, brand_id, product_id,
     gross_amount, discount_amount, net_revenue, shipping_fee)
SELECT
    2, d, 6, 6, p,
    ROUND((RANDOM() * 1100000 + 400000)::numeric, 2),
    ROUND((RANDOM() * 60000   + 20000)::numeric,  2),
    ROUND((RANDOM() * 1000000 + 350000)::numeric, 2),
    ROUND((RANDOM() * 7000    + 3000)::numeric,   2)
FROM generate_series('2024-01-01'::date, '2024-03-31'::date, '1 day'::interval) AS d
CROSS JOIN unnest(ARRAY[21,22,23,24]) AS p;

-- Company 3 / Store 7 / Brand 7 / Products 25-28
INSERT INTO daily_sales_stats
    (company_id, date, store_id, brand_id, product_id,
     gross_amount, discount_amount, net_revenue, shipping_fee)
SELECT
    3, d, 7, 7, p,
    ROUND((RANDOM() * 400000 + 80000)::numeric,  2),
    ROUND((RANDOM() * 20000  + 5000)::numeric,   2),
    ROUND((RANDOM() * 350000 + 70000)::numeric,  2),
    ROUND((RANDOM() * 3000   + 1500)::numeric,   2)
FROM generate_series('2024-01-01'::date, '2024-03-31'::date, '1 day'::interval) AS d
CROSS JOIN unnest(ARRAY[25,26,27,28]) AS p;

-- Company 3 / Store 8 / Brand 8 / Products 29-32
INSERT INTO daily_sales_stats
    (company_id, date, store_id, brand_id, product_id,
     gross_amount, discount_amount, net_revenue, shipping_fee)
SELECT
    3, d, 8, 8, p,
    ROUND((RANDOM() * 500000 + 100000)::numeric, 2),
    ROUND((RANDOM() * 25000  + 8000)::numeric,   2),
    ROUND((RANDOM() * 450000 + 85000)::numeric,  2),
    ROUND((RANDOM() * 4000   + 2000)::numeric,   2)
FROM generate_series('2024-01-01'::date, '2024-03-31'::date, '1 day'::interval) AS d
CROSS JOIN unnest(ARRAY[29,30,31,32]) AS p;

-- Company 3 / Store 9 / Brand 9 / Products 33-36
INSERT INTO daily_sales_stats
    (company_id, date, store_id, brand_id, product_id,
     gross_amount, discount_amount, net_revenue, shipping_fee)
SELECT
    3, d, 9, 9, p,
    ROUND((RANDOM() * 300000 + 50000)::numeric,  2),
    ROUND((RANDOM() * 15000  + 3000)::numeric,   2),
    ROUND((RANDOM() * 260000 + 45000)::numeric,  2),
    ROUND((RANDOM() * 2500   + 1000)::numeric,   2)
FROM generate_series('2024-01-01'::date, '2024-03-31'::date, '1 day'::interval) AS d
CROSS JOIN unnest(ARRAY[33,34,35,36]) AS p;
