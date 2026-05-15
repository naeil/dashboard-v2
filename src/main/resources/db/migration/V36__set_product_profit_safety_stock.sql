UPDATE executive_product_profit
SET safe_stock = 3000
WHERE company_id = 1
  AND sku LIKE 'DK-ONLINE-%'
  AND COALESCE(safe_stock, 0) = 0;
