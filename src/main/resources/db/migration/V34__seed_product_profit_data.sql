INSERT INTO executive_product_profit (
    company_id, product_name, sku, category, production_cost, supply_price, selling_price,
    platform_fee, ad_cost, logistics_cost, expected_net_profit, margin_rate,
    sold_quantity, stock_quantity, safe_stock, expiry_date, status
)
SELECT *
FROM (
    VALUES
        (1, '단백깡 갈릭새우깡', 'DANBAEKKANG-GARLIC-SHRIMP', '단백질 스낵', 1619, 3415, 3500, 162, 324, 20, 970, 28.00, 1850, 6800, 3000, DATE '2027-04-30', 'NORMAL'),
        (1, '단백깡 알싸고추깡', 'DANBAEKKANG-SPICY-PEPPER', '단백질 스낵', 802, 1705, 2500, 80, 160, 20, 1237, 49.00, 2400, 2200, 2500, DATE '2027-04-30', 'LOW_STOCK'),
        (1, '단백깡 야채포테이토깡', 'DANBAEKKANG-VEG-POTATO', '단백질 스낵', 804, 1710, 2500, 80, 161, 20, 1234, 49.00, 2100, 11200, 3000, DATE '2027-04-30', 'OVER_STOCK')
) AS seed(
    company_id, product_name, sku, category, production_cost, supply_price, selling_price,
    platform_fee, ad_cost, logistics_cost, expected_net_profit, margin_rate,
    sold_quantity, stock_quantity, safe_stock, expiry_date, status
)
WHERE NOT EXISTS (
    SELECT 1
    FROM executive_product_profit existing
    WHERE existing.company_id = seed.company_id
      AND existing.sku = seed.sku
);
