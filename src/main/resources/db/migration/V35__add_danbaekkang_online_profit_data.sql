ALTER TABLE executive_product_profit
    ADD COLUMN IF NOT EXISTS bundle_quantity INTEGER,
    ADD COLUMN IF NOT EXISTS total_weight_g INTEGER,
    ADD COLUMN IF NOT EXISTS consumer_price NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS final_discount_price NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS unit_selling_price NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS customer_shipping_fee NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS gross_sales NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS marketing_cost NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS operating_admin_cost NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS storage_cost NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS total_admin_cost NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS gross_profit_rate NUMERIC(7, 2),
    ADD COLUMN IF NOT EXISTS note VARCHAR(500);

DELETE FROM executive_product_profit
WHERE company_id = 1
  AND (
      sku IN ('DANBAEKKANG-GARLIC-SHRIMP', 'DANBAEKKANG-SPICY-PEPPER', 'DANBAEKKANG-VEG-POTATO')
      OR sku LIKE 'DK-ONLINE-%'
  );

INSERT INTO executive_product_profit (
    company_id, product_name, sku, category, bundle_quantity, total_weight_g,
    production_cost, consumer_price, discount_amount, final_discount_price, unit_selling_price,
    customer_shipping_fee, gross_sales, marketing_cost, ad_cost, operating_admin_cost,
    platform_fee, storage_cost, logistics_cost, total_admin_cost, gross_profit, gross_profit_rate,
    supply_price, selling_price, expected_net_profit, margin_rate,
    sold_quantity, stock_quantity, safe_stock, expiry_date, status, note
)
VALUES
    (1, '단백깡 갈릭새우깡 1개입', 'DK-ONLINE-GARLIC-01', '온라인 판매', 1, 50, 1619, 5000, 0, 5000, 5000, 3000, 8000, 250, 500, 750, 300, 300, 4000, 5800, 6381, 25, 5000, 5000, 581, 7, 0, 0, 0, DATE '2027-04-30', 'LOW_MARGIN', '스토어팜/자사몰 온라인 판매가'),
    (1, '단백깡 갈릭새우깡 6개입', 'DK-ONLINE-GARLIC-06', '온라인 판매', 6, 300, 9714, 30000, 8000, 22000, 3667, 3000, 25000, 1100, 2200, 3300, 1320, 120, 4000, 12040, 15286, 64, 3667, 22000, 3246, 13, 0, 0, 0, DATE '2027-04-30', 'NORMAL', '스토어팜/자사몰 온라인 판매가'),
    (1, '단백깡 갈릭새우깡 10개입', 'DK-ONLINE-GARLIC-10', '온라인 판매', 10, 500, 16190, 50000, 15000, 35000, 3500, 3000, 38000, 1750, 3500, 5250, 2100, 200, 4200, 17000, 21810, 74, 3500, 35000, 4810, 13, 0, 0, 0, DATE '2027-04-30', 'NORMAL', '스토어팜/자사몰 온라인 판매가'),
    (1, '단백깡 갈릭새우깡 24개입', 'DK-ONLINE-GARLIC-24', '온라인 판매', 24, 1200, 38857, 120000, 43000, 77000, 3208, 0, 77000, 3850, 7700, 11550, 4620, 480, 4200, 32400, 38143, 102, 3208, 77000, 5743, 7, 0, 0, 0, DATE '2027-04-30', 'LOW_MARGIN', '스토어팜/자사몰 온라인 판매가'),
    (1, '단백깡 알싸고추깡/야채포테이토깡 1개입', 'DK-ONLINE-SPICY-VEG-01', '온라인 판매', 1, 50, 802, 4000, 0, 4000, 4000, 3000, 7000, 200, 400, 600, 240, 20, 4200, 5660, 6198, 13, 4000, 4000, 538, 8, 0, 0, 0, DATE '2027-04-30', 'LOW_MARGIN', '알싸고추깡과 야채포테이토깡 공통 온라인 판매가'),
    (1, '단백깡 알싸고추깡/야채포테이토깡 6개입', 'DK-ONLINE-SPICY-VEG-06', '온라인 판매', 6, 300, 4811, 24000, 7000, 17000, 2833, 3000, 20000, 850, 1700, 2550, 1020, 120, 4200, 10440, 15189, 32, 2833, 17000, 4749, 24, 0, 0, 0, DATE '2027-04-30', 'NORMAL', '알싸고추깡과 야채포테이토깡 공통 온라인 판매가'),
    (1, '단백깡 알싸고추깡/야채포테이토깡 10개입', 'DK-ONLINE-SPICY-VEG-10', '온라인 판매', 10, 500, 8019, 40000, 13000, 27000, 2700, 3000, 30000, 1350, 2700, 4050, 1620, 200, 4200, 14120, 21981, 36, 2700, 27000, 7861, 26, 0, 0, 0, DATE '2027-04-30', 'NORMAL', '알싸고추깡과 야채포테이토깡 공통 온라인 판매가'),
    (1, '단백깡 알싸고추깡/야채포테이토깡 24개입', 'DK-ONLINE-SPICY-VEG-24', '온라인 판매', 24, 1200, 19246, 96000, 39000, 57000, 2375, 0, 57000, 2850, 5700, 8550, 3420, 480, 4200, 25200, 37754, 51, 2375, 57000, 12554, 22, 0, 0, 0, DATE '2027-04-30', 'NORMAL', '알싸고추깡과 야채포테이토깡 공통 온라인 판매가'),
    (1, '단백깡 3종 묶음 3개입', 'DK-ONLINE-SET3-03', '온라인 판매', 3, 150, 3225, 13500, 2000, 11500, 3833, 3000, 14500, 575, 1150, 1725, 690, 60, 4200, 8400, 11275, 29, 3833, 11500, 2875, 20, 0, 0, 0, DATE '2027-04-30', 'NORMAL', '3종 묶음 온라인 판매가'),
    (1, '단백깡 3종 묶음 6개입', 'DK-ONLINE-SET3-06', '온라인 판매', 6, 300, 6450, 27000, 7000, 20000, 3333, 3000, 23000, 1000, 2000, 3000, 1200, 120, 4200, 11520, 16550, 39, 3333, 20000, 5030, 22, 0, 0, 0, DATE '2027-04-30', 'NORMAL', '3종 묶음 온라인 판매가'),
    (1, '단백깡 3종 묶음 12개입', 'DK-ONLINE-SET3-12', '온라인 판매', 12, 600, 12900, 54000, 17000, 37000, 3083, 3000, 40000, 1850, 3700, 5550, 2220, 240, 4200, 17760, 27100, 48, 3083, 37000, 9340, 23, 0, 0, 0, DATE '2027-04-30', 'NORMAL', '3종 묶음 온라인 판매가'),
    (1, '단백깡 3종 묶음 24개입', 'DK-ONLINE-SET3-24', '온라인 판매', 24, 1200, 25800, 108000, 42000, 66000, 2750, 0, 66000, 3300, 6600, 9900, 3960, 480, 4200, 28440, 40200, 64, 2750, 66000, 11760, 18, 0, 0, 0, DATE '2027-04-30', 'NORMAL', '3종 묶음 온라인 판매가');
