UPDATE executive_product_profit
SET total_admin_cost = COALESCE(marketing_cost, 0)
        + COALESCE(ad_cost, 0)
        + COALESCE(operating_admin_cost, 0)
        + COALESCE(platform_fee, 0)
        + COALESCE(storage_cost, 0)
        + COALESCE(logistics_cost, 0),
    gross_profit = COALESCE(gross_sales, 0) - COALESCE(production_cost, 0),
    gross_profit_rate = CASE
        WHEN COALESCE(gross_sales, 0) = 0 THEN 0
        ELSE ROUND(((COALESCE(gross_sales, 0) - COALESCE(production_cost, 0)) / COALESCE(gross_sales, 0)) * 100, 2)
    END,
    expected_net_profit = COALESCE(gross_sales, 0)
        - COALESCE(production_cost, 0)
        - (
            COALESCE(marketing_cost, 0)
            + COALESCE(ad_cost, 0)
            + COALESCE(operating_admin_cost, 0)
            + COALESCE(platform_fee, 0)
            + COALESCE(storage_cost, 0)
            + COALESCE(logistics_cost, 0)
        ),
    margin_rate = CASE
        WHEN COALESCE(gross_sales, 0) = 0 THEN 0
        ELSE ROUND((
            (
                COALESCE(gross_sales, 0)
                - COALESCE(production_cost, 0)
                - (
                    COALESCE(marketing_cost, 0)
                    + COALESCE(ad_cost, 0)
                    + COALESCE(operating_admin_cost, 0)
                    + COALESCE(platform_fee, 0)
                    + COALESCE(storage_cost, 0)
                    + COALESCE(logistics_cost, 0)
                )
            ) / COALESCE(gross_sales, 0)
        ) * 100, 2)
    END
WHERE gross_sales IS NOT NULL;
