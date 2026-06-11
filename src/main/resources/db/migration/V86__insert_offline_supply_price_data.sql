-- 오프라인 거래처 제품 원가 데이터 (단백깡 공급가표)
-- 채널: 트레이더스, 제로스토어
-- 컬럼: company_id=1, channel_name, product_code, product_name,
--        qty_per_unit, production_cost(개당제조원가), list_price(공급가),
--        consumer_price(개당소비자가), channel_fee_rate(거래처마진율)

INSERT INTO product_cost_channel
    (company_id, channel_name, product_code, product_name, sku_code,
     qty_per_unit, production_cost, list_price, consumer_price,
     channel_fee_rate, marketing_rate, ad_rate, opex_rate,
     consumer_ship_fee, storage_fee_unit)
VALUES
-- 트레이더스
(1, '오프라인(트레이더스)', '트레이더스_단백깡갈릭새우깡',   '단백깡 갈릭새우깡',    NULL, 6, 1620, 12444, 3400, 0.39, 0, 0, 0, 0, 0),
(1, '오프라인(트레이더스)', '트레이더스_단백깡알싸고추깡',   '단백깡 알싸고추깡',    NULL, 6,  810,  7740, 2150, 0.39, 0, 0, 0, 0, 0),
(1, '오프라인(트레이더스)', '트레이더스_단백깡야채포테이토깡', '단백깡 야채포테이토깡', NULL, 6,  810,  7740, 2150, 0.39, 0, 0, 0, 0, 0),
-- 제로스토어
(1, '오프라인(제로스토어)', '제로스토어_단백깡갈릭새우깡',   '단백깡 갈릭새우깡',    NULL, 1, 1620,  2850, 3500, 0.1865, 0.1, 0, 0, 0, 0),
(1, '오프라인(제로스토어)', '제로스토어_단백깡알싸고추깡',   '단백깡 알싸고추깡',    NULL, 1,  810,  1570, 2500, 0.372,  0.1, 0, 0, 0, 0),
(1, '오프라인(제로스토어)', '제로스토어_단백깡야채포테이토깡', '단백깡 야채포테이토깡', NULL, 1,  810,  1570, 2500, 0.372,  0.1, 0, 0, 0, 0)
ON CONFLICT (company_id, channel_name, product_code) DO UPDATE SET
    product_name     = EXCLUDED.product_name,
    qty_per_unit     = EXCLUDED.qty_per_unit,
    production_cost  = EXCLUDED.production_cost,
    list_price       = EXCLUDED.list_price,
    consumer_price   = EXCLUDED.consumer_price,
    channel_fee_rate = EXCLUDED.channel_fee_rate,
    marketing_rate   = EXCLUDED.marketing_rate,
    updated_at       = NOW();
