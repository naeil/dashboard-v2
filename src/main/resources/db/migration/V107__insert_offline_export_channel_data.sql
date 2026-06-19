-- 오프라인(납품처별) 수출 판매 데이터 (12건)
-- country, channel, product_name, production_cost 기준
-- buyer_country → product_code 에 국가 코드로 저장
-- trade_channel → sku_code 에 offline/retail 저장
-- trade_terms, currency, exchange_rate → note 에 JSON 형태로 저장

INSERT INTO product_cost_channel
  (company_id, channel_name, product_code, product_name, sku_code,
   qty_per_unit, production_cost, list_price, consumer_price,
   channel_fee_rate, marketing_rate, ad_rate, opex_rate,
   consumer_ship_fee, storage_fee_unit, note)
VALUES
-- Mongolia - offline
(1, '오프라인(납품처별)', 'EXPORT-MN-갈릭새우깑', '갈릭새우깑', 'offline',
 1, 1620, 0, 0, 0, 0, 0, 0, 0, 0,
 '{"buyer_country":"Mongolia","buyer_name":"","trade_channel":"offline","trade_terms":"EXW","currency":"KRW","exchange_rate":1}'),
(1, '오프라인(납품처별)', 'EXPORT-MN-알싸고추깑', '알싸고추깑', 'offline',
 1, 810, 0, 0, 0, 0, 0, 0, 0, 0,
 '{"buyer_country":"Mongolia","buyer_name":"","trade_channel":"offline","trade_terms":"EXW","currency":"KRW","exchange_rate":1}'),
(1, '오프라인(납품처별)', 'EXPORT-MN-야채포테이토깑', '야채포테이토깑', 'offline',
 1, 810, 0, 0, 0, 0, 0, 0, 0, 0,
 '{"buyer_country":"Mongolia","buyer_name":"","trade_channel":"offline","trade_terms":"EXW","currency":"KRW","exchange_rate":1}'),
-- Taiwan - retail
(1, '오프라인(납품처별)', 'EXPORT-TW-갈릭새우깑', '갈릭새우깑', 'retail',
 1, 1620, 0, 0, 0, 0, 0, 0, 0, 0,
 '{"buyer_country":"Taiwan","buyer_name":"","trade_channel":"retail","trade_terms":"EXW","currency":"KRW","exchange_rate":1}'),
(1, '오프라인(납품처별)', 'EXPORT-TW-알싸고추깑', '알싸고추깑', 'retail',
 1, 810, 0, 0, 0, 0, 0, 0, 0, 0,
 '{"buyer_country":"Taiwan","buyer_name":"","trade_channel":"retail","trade_terms":"EXW","currency":"KRW","exchange_rate":1}'),
(1, '오프라인(납품처별)', 'EXPORT-TW-야채포테이토깑', '야채포테이토깑', 'retail',
 1, 810, 0, 0, 0, 0, 0, 0, 0, 0,
 '{"buyer_country":"Taiwan","buyer_name":"","trade_channel":"retail","trade_terms":"EXW","currency":"KRW","exchange_rate":1}'),
-- Vietnam - retail
(1, '오프라인(납품처별)', 'EXPORT-VN-갈릭새우깑', '갈릭새우깑', 'retail',
 1, 1620, 0, 0, 0, 0, 0, 0, 0, 0,
 '{"buyer_country":"Vietnam","buyer_name":"","trade_channel":"retail","trade_terms":"EXW","currency":"KRW","exchange_rate":1}'),
(1, '오프라인(납품처별)', 'EXPORT-VN-알싸고추깑', '알싸고추깑', 'retail',
 1, 810, 0, 0, 0, 0, 0, 0, 0, 0,
 '{"buyer_country":"Vietnam","buyer_name":"","trade_channel":"retail","trade_terms":"EXW","currency":"KRW","exchange_rate":1}'),
(1, '오프라인(납품처별)', 'EXPORT-VN-야채포테이토깑', '야채포테이토깑', 'retail',
 1, 810, 0, 0, 0, 0, 0, 0, 0, 0,
 '{"buyer_country":"Vietnam","buyer_name":"","trade_channel":"retail","trade_terms":"EXW","currency":"KRW","exchange_rate":1}'),
-- USA - retail
(1, '오프라인(납품처별)', 'EXPORT-US-갈릭새우깑', '갈릭새우깑', 'retail',
 1, 1620, 0, 0, 0, 0, 0, 0, 0, 0,
 '{"buyer_country":"USA","buyer_name":"","trade_channel":"retail","trade_terms":"EXW","currency":"KRW","exchange_rate":1}'),
(1, '오프라인(납품처별)', 'EXPORT-US-알싸고추깑', '알싸고추깑', 'retail',
 1, 810, 0, 0, 0, 0, 0, 0, 0, 0,
 '{"buyer_country":"USA","buyer_name":"","trade_channel":"retail","trade_terms":"EXW","currency":"KRW","exchange_rate":1}'),
(1, '오프라인(납품처별)', 'EXPORT-US-야채포테이토깑', '야채포테이토깑', 'retail',
 1, 810, 0, 0, 0, 0, 0, 0, 0, 0,
 '{"buyer_country":"USA","buyer_name":"","trade_channel":"retail","trade_terms":"EXW","currency":"KRW","exchange_rate":1}')
ON CONFLICT (company_id, channel_name, product_code) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  sku_code = EXCLUDED.sku_code,
  production_cost = EXCLUDED.production_cost,
  note = EXCLUDED.note,
  updated_at = NOW();
