ALTER TABLE executive_product_forecast
    ALTER COLUMN forecast_months SET DEFAULT 12;

UPDATE executive_product_forecast
SET forecast_months = 12
WHERE forecast_months IS NULL OR forecast_months <> 12;
