ALTER TABLE executive_product_profit
    ADD COLUMN IF NOT EXISTS package_composition VARCHAR(160),
    ADD COLUMN IF NOT EXISTS export_cost_ex_vat NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS export_supply_price_5000 NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS export_supply_price_10000 NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS export_supply_price_20000 NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS daily_production_moq INTEGER,
    ADD COLUMN IF NOT EXISTS carton_quantity VARCHAR(40),
    ADD COLUMN IF NOT EXISTS pallet_quantity INTEGER,
    ADD COLUMN IF NOT EXISTS manufacture_date DATE,
    ADD COLUMN IF NOT EXISTS expiry_check_date DATE,
    ADD COLUMN IF NOT EXISTS supplied_materials VARCHAR(500),
    ADD COLUMN IF NOT EXISTS issue_text VARCHAR(1000);

INSERT INTO executive_product_profit (
    company_id, category, product_name, sku, package_composition,
    production_cost, supply_price, selling_price, gross_sales, gross_profit, expected_net_profit,
    margin_rate, export_cost_ex_vat, export_supply_price_5000, export_supply_price_10000,
    export_supply_price_20000, daily_production_moq, carton_quantity, pallet_quantity,
    manufacture_date, expiry_check_date, expiry_date, supplied_materials, issue_text,
    stock_quantity, safe_stock, status, note
)
SELECT *
FROM (
    VALUES
        (1, '하이프리', '프리당생생효소', 'HF-FREEDANG-ENZYME', '2g x 14포', 3400, 4590, 4590, 22950000, 7650000, 7650000, 33.00, 3060, 4590, 4284, 3978, 70000, '50ea', 80, DATE '2025-01-10', DATE '2027-01-01', DATE '2027-01-01', 'x', '26년 2월 27일 6,219개 3PL 입고', 6219, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '하이프리', '프리하닭 오리지널', 'HF-CHICKEN-ORIGINAL', '100g 1팩', 977, 1319, 1319, 6594750, 2198250, 2198250, 33.00, 879, 1319, 1231, 1143, 10000, '40ea', NULL, DATE '2025-02-12', DATE '2026-02-12', DATE '2026-02-12', '필름, 닭원육', '25년 10월 27일 1,180개 3PL 입고 / 26년 2월 19일 1,797개 3PL 입고', 2977, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '하이프리', '프리하닭 매콤양념', 'HF-CHICKEN-SPICY', '100g 1팩', 977, 1319, 1319, 6594750, 2198250, 2198250, 33.00, 879, 1319, 1231, 1143, 10000, '40ea', NULL, DATE '2025-02-12', DATE '2026-02-12', DATE '2026-02-12', '필름, 닭원육', '25년 10월 27일 327개 3PL 입고 / 26년 2월 19일 1,460개 3PL 입고', 1787, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '하이프리', '프리하닭 블랙페퍼', 'HF-CHICKEN-BLACKPEPPER', '100g 1팩', 977, 1319, 1319, 6594750, 2198250, 2198250, 33.00, 879, 1319, 1231, 1143, 10000, '44ea', NULL, DATE '2025-10-22', DATE '2026-10-22', DATE '2026-10-22', '필름, 닭원육', '25년 10월 27일 2,200개 3PL 입고', 2200, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '하이프리', '프리하닭 큐브', 'HF-CHICKEN-CUBE', '100g 1팩', 977, 1319, 1319, 6594750, 2198250, 2198250, 33.00, 879, 1319, 1231, 1143, 10000, '40ea', NULL, DATE '2025-02-12', DATE '2026-02-12', DATE '2026-02-12', '필름, 닭원육', '25년 10월 27일 591개 3PL 입고 / 26년 2월 19일 1,009개 3PL 입고', 1600, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '하이프리', '단백깡 갈릭새우깡', 'HF-DANBAEKKANG-GARLIC-SHRIMP', '50g 1봉지', 1620, 2187, 2187, 10935000, 3645000, 3645000, 33.00, 1458, 2187, 2041, 1895, 10000, '40박스', 1, DATE '2026-03-15', DATE '2027-03-15', DATE '2027-03-15', '프로틴볼, 시즈닝, 필름, 카톤박스, 스티커', '26년 3월 19일 3,072개 3PL 입고 / 26년 3월 19일 9,504개 익산 물류창고 입고', 12576, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '하이프리', '단백깡 야채포테이토깡', 'HF-DANBAEKKANG-VEG-POTATO', '50g 1봉지', 810, 1094, 1094, 5467500, 1822500, 1822500, 33.00, 729, 1094, 1021, 948, 10000, '40박스', 1, DATE '2026-03-15', DATE '2027-03-15', DATE '2027-03-15', '시즈닝, 필름, 카톤박스, 스티커', '26년 3월 19일 4,352개 3PL 입고 / 26년 3월 19일 160개 익산 물류창고 입고', 4512, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '하이프리', '단백깡 알싸고추깡', 'HF-DANBAEKKANG-SPICY-PEPPER', '50g 1봉지', 810, 1094, 1094, 5467500, 1822500, 1822500, 33.00, 729, 1094, 1021, 948, 10000, '40박스', 1, DATE '2026-03-15', DATE '2027-03-15', DATE '2027-03-15', '시즈닝, 필름, 카톤박스, 스티커', '26년 3월 19일 5,362개 3PL 입고 / 26년 3월 19일 7,776개 익산 물류창고 입고', 13138, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '국민한상', '국민왕돈까스 300g (5장x1팩)', 'GHS-PORKCUTLET-KING-300', '1팩(300g x 5장)', 14075, 19001, 19001, 95006250, 31668750, 31668750, 33.00, 12668, 19001, 17735, 16468, 440, '42', 1, NULL, NULL, DATE '2026-07-07', '스티커', '25년 12월 1일 3PL 228개 입고', 228, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '국민한상', '국민등심돈까스 180g (5장x1팩)', 'GHS-PORKCUTLET-SIRLOIN-180', '1팩(180g x 5장)', 8135, 10982, 10982, 54911250, 18303750, 18303750, 33.00, 7322, 10982, 10250, 9518, 888, '30', 1, NULL, NULL, DATE '2026-07-07', '스티커', '25년 12월 1일 3PL 526개 입고 / 26년 3월 6일 3PL 536개 입고', 1062, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '국민한상', '치즈돈까스 200g (5장x1팩)', 'GHS-PORKCUTLET-CHEESE-200', '1팩(200g x 5장)', 9845, 13291, 13291, 66453750, 22151250, 22151250, 33.00, 8861, 13291, 12405, 11519, 110, '30', 1, DATE '2026-09-01', DATE '2026-10-01', DATE '2026-10-01', '스티커', '26년 9월 22일 입고 110팩', 110, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '국민한상', '슬라이스삼겹', 'GHS-PORKBELLY-SLICE-500', '500g 1팩', 4750, 6413, 6413, 32062500, 10687500, 10687500, 33.00, 4275, 6413, 5985, 5558, NULL, NULL, NULL, DATE '2026-02-27', DATE '2027-02-27', DATE '2027-02-27', 'x', NULL, 0, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '국민한상', '벌집삼겹살', 'GHS-PORKBELLY-HONEYCOMB-500', '500g 1팩', 4750, 6413, 6413, 32062500, 10687500, 10687500, 33.00, 4275, 6413, 5985, 5558, NULL, NULL, NULL, DATE '2026-02-27', DATE '2027-02-27', DATE '2027-02-27', 'x', NULL, 0, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '국민한상', '통삼겹살', 'GHS-PORKBELLY-WHOLE-1KG', '1kg 1팩', 9500, 12825, 12825, 64125000, 21375000, 21375000, 33.00, 8550, 12825, 11970, 11115, NULL, NULL, NULL, DATE '2026-02-27', DATE '2027-02-27', DATE '2027-02-27', 'x', NULL, 0, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '국민한상', '대패삼겹살', 'GHS-PORKBELLY-THIN-500', '500g 1팩', 4900, 6615, 6615, 33075000, 11025000, 11025000, 33.00, 4410, 6615, 6174, 5733, NULL, NULL, NULL, DATE '2026-02-27', DATE '2027-02-27', DATE '2027-02-27', 'x', NULL, 0, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '국민한상', '돈목살구이', 'GHS-PORKNECK-GRILL-500', '500g 1팩', 4250, 5738, 5738, 28687500, 9562500, 9562500, 33.00, 3825, 5738, 5355, 4973, NULL, NULL, NULL, DATE '2026-02-27', DATE '2027-02-27', DATE '2027-02-27', 'x', NULL, 0, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '국민한상', '돈목살볶음', 'GHS-PORKNECK-STIRFRY-500', '500g 1팩', 4250, 5738, 5738, 28687500, 9562500, 9562500, 33.00, 3825, 5738, 5355, 4973, NULL, NULL, NULL, DATE '2026-02-27', DATE '2027-02-27', DATE '2027-02-27', 'x', NULL, 0, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '국민한상', '돈목살큐브', 'GHS-PORKNECK-CUBE-500', '500g 1팩', 4250, 5738, 5738, 28687500, 9562500, 9562500, 33.00, 3825, 5738, 5355, 4973, NULL, NULL, NULL, DATE '2026-02-27', DATE '2027-02-27', DATE '2027-02-27', 'x', NULL, 0, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '국민한상', '돈목전지', 'GHS-PORKSHOULDER-FRONT-500', '500g 1팩', 3300, 4455, 4455, 22275000, 7425000, 7425000, 33.00, 2970, 4455, 4158, 3861, NULL, NULL, NULL, DATE '2026-02-27', DATE '2027-02-27', DATE '2027-02-27', 'x', NULL, 0, 3000, 'NORMAL', '현재 SKU 마스터'),
        (1, '국민한상', '육회', 'GHS-BEEF-TARTARE-500', '500g 1팩', 3300, 4455, 4455, 22275000, 7425000, 7425000, 33.00, 2970, 4455, 4158, 3861, NULL, NULL, NULL, DATE '2026-02-27', DATE '2027-02-27', DATE '2027-02-27', 'x', NULL, 0, 3000, 'NORMAL', '현재 SKU 마스터')
) AS seed(
    company_id, category, product_name, sku, package_composition,
    production_cost, supply_price, selling_price, gross_sales, gross_profit, expected_net_profit,
    margin_rate, export_cost_ex_vat, export_supply_price_5000, export_supply_price_10000,
    export_supply_price_20000, daily_production_moq, carton_quantity, pallet_quantity,
    manufacture_date, expiry_check_date, expiry_date, supplied_materials, issue_text,
    stock_quantity, safe_stock, status, note
)
WHERE NOT EXISTS (
    SELECT 1
    FROM executive_product_profit existing
    WHERE existing.company_id = seed.company_id
      AND existing.sku = seed.sku
);
