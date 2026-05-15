UPDATE executive_product_profit
SET category = '하이프리'
WHERE company_id = 1
  AND (
      sku LIKE 'DK-ONLINE-%'
      OR product_name LIKE '단백깡%'
  );
