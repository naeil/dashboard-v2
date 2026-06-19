-- V108: 오프라인 국내 채널 데이터 20건 (company_id 포함)
-- 트레이더스/제로스토어/온라인할인가/폐쇄몰/랭킹닭컴
INSERT INTO product_cost_channel
  (company_id, channel_name, product_code, product_name, sku_code, qty_per_unit,
   production_cost, list_price, consumer_price,
   channel_fee_rate, marketing_rate, ad_rate, opex_rate,
   consumer_ship_fee, storage_fee_unit, note)
VALUES
-- 트레이더스
(1,'트레이더스','','갈릭새우깡','',1, 1620,3400,3400, 0,0,0,0, 0,335, '{"partner_margin_rate":0.39,"supply_price":2074,"promotion_sample_cost":335}'),
(1,'트레이더스','','알싸고추깡','',1, 810,2150,2150, 0,0,0,0, 0,273, '{"partner_margin_rate":0.40,"supply_price":1290,"promotion_sample_cost":273}'),
(1,'트레이더스','','야채포테이토깡','',1, 810,2150,2150, 0,0,0,0, 0,273, '{"partner_margin_rate":0.40,"supply_price":1290,"promotion_sample_cost":273}'),
-- 제로스토어 위탁
(1,'제로스토어 위탁','','갈릭새우깡','',1, 1620,3500,3500, 0,0.10,0.10,0.20, 200,25, '{"partner_margin_rate":0.186,"supply_price":2850}'),
(1,'제로스토어 위탁','','알싸고추깡','',1, 810,2500,2500, 0,0.10,0.10,0.20, 200,25, '{"partner_margin_rate":0.372,"supply_price":1570}'),
(1,'제로스토어 위탁','','야채포테이토깡','',1, 810,2500,2500, 0,0.10,0.10,0.20, 200,25, '{"partner_margin_rate":0.372,"supply_price":1570}'),
-- 제로스토어 사입
(1,'제로스토어 사입','','갈릭새우깡','',1, 1620,3500,3500, 0,0.10,0.05,0.20, 200,25, '{"partner_margin_rate":0.20,"supply_price":2800}'),
(1,'제로스토어 사입','','알싸고추깡','',1, 810,2500,2500, 0,0.10,0.05,0.20, 200,25, '{"partner_margin_rate":0.40,"supply_price":1500}'),
(1,'제로스토어 사입','','야채포테이토깡','',1, 810,2500,2500, 0,0.10,0.05,0.20, 200,25, '{"partner_margin_rate":0.40,"supply_price":1500}'),
-- 온라인 할인가
(1,'온라인 할인가','','갈릭새우깡','',1, 1620,3400,3400, 0.06,0.10,0.20,0.30, 420,20, NULL),
(1,'온라인 할인가','','알싸고추깡','',1, 810,2700,2700, 0.06,0.10,0.20,0.30, 420,20, NULL),
(1,'온라인 할인가','','야채포테이토깡','',1, 810,2700,2700, 0.06,0.10,0.20,0.30, 420,20, NULL),
-- 폐쇄몰 위탁
(1,'폐쇄몰 위탁','','갈릭새우깡','',1, 1620,3350,3350, 0,0.10,0.10,0.20, 0,25, '{"partner_margin_rate":0.18,"supply_price":2747}'),
(1,'폐쇄몰 위탁','','알싸고추깡','',1, 810,2600,2600, 0,0.10,0.10,0.20, 0,25, '{"partner_margin_rate":0.30,"supply_price":1820}'),
(1,'폐쇄몰 위탁','','야채포테이토깡','',1, 810,2600,2600, 0,0.10,0.10,0.20, 0,25, '{"partner_margin_rate":0.30,"supply_price":1820}'),
-- 폐쇄몰 사입
(1,'폐쇄몰 사입','','갈릭새우깡','',1, 1620,3350,3350, 0,0.10,0.05,0.20, 200,25, '{"partner_margin_rate":0.22,"supply_price":2613}'),
(1,'폐쇄몰 사입','','알싸고추깡','',1, 810,2600,2600, 0,0.10,0.05,0.20, 200,25, '{"partner_margin_rate":0.35,"supply_price":1690}'),
(1,'폐쇄몰 사입','','야채포테이토깡','',1, 810,2600,2600, 0,0.10,0.05,0.20, 200,25, '{"partner_margin_rate":0.35,"supply_price":1690}'),
-- 랭킹닭컴 위탁
(1,'랭킹닭컴 위탁','','프리하닭 닭가슴살 24팩','',1, 27360,54900,54900, 0,0.10,0.05,0.10, 5010,25, '{"partner_margin_rate":0.25}'),
(1,'랭킹닭컴 위탁','','프리하닭 닭가슴살 32팩','',1, 36480,71900,71900, 0,0.10,0.05,0.10, 4860,25, '{"partner_margin_rate":0.25}')
ON CONFLICT (company_id, channel_name, product_code) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  production_cost = EXCLUDED.production_cost,
  list_price = EXCLUDED.list_price,
  consumer_price = EXCLUDED.consumer_price,
  channel_fee_rate = EXCLUDED.channel_fee_rate,
  marketing_rate = EXCLUDED.marketing_rate,
  ad_rate = EXCLUDED.ad_rate,
  opex_rate = EXCLUDED.opex_rate,
  consumer_ship_fee = EXCLUDED.consumer_ship_fee,
  storage_fee_unit = EXCLUDED.storage_fee_unit,
  note = EXCLUDED.note,
  updated_at = NOW();
