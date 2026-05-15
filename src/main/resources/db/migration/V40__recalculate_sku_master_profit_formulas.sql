UPDATE executive_product_profit
SET gross_profit = COALESCE(gross_sales, 0) - CASE
        WHEN COALESCE(export_cost_ex_vat, 0) > 0 THEN COALESCE(export_cost_ex_vat, 0) * 5000
        ELSE COALESCE(production_cost, 0)
    END,
    gross_profit_rate = CASE
        WHEN COALESCE(gross_sales, 0) = 0 THEN 0
        ELSE ROUND((
            COALESCE(gross_sales, 0) - CASE
                WHEN COALESCE(export_cost_ex_vat, 0) > 0 THEN COALESCE(export_cost_ex_vat, 0) * 5000
                ELSE COALESCE(production_cost, 0)
            END
        ) / COALESCE(gross_sales, 0) * 100, 2)
    END,
    expected_net_profit = COALESCE(gross_sales, 0)
        - CASE
            WHEN COALESCE(export_cost_ex_vat, 0) > 0 THEN COALESCE(export_cost_ex_vat, 0) * 5000
            ELSE COALESCE(production_cost, 0)
        END
        - COALESCE(total_admin_cost, 0),
    margin_rate = CASE
        WHEN COALESCE(gross_sales, 0) = 0 THEN 0
        ELSE ROUND((
            COALESCE(gross_sales, 0)
            - CASE
                WHEN COALESCE(export_cost_ex_vat, 0) > 0 THEN COALESCE(export_cost_ex_vat, 0) * 5000
                ELSE COALESCE(production_cost, 0)
            END
            - COALESCE(total_admin_cost, 0)
        ) / COALESCE(gross_sales, 0) * 100, 2)
    END
WHERE gross_sales IS NOT NULL;
