package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 입출고 이력 + 재고 예측 (소진 속도 기반)
 * 출고: product_outbound (PlayAuto + 정산시트), 입고: product_inbound (정산시트), 현재고: product.real_stock
 */
@Service
@RequiredArgsConstructor
public class InventoryInsightService {

    private final JdbcTemplate jdbcTemplate;

    /** 일별 입·출고 이력 (제품×일자) */
    public Map<String, Object> getInventoryFlow(Long companyId, int days, String search) {
        LocalDate from = LocalDate.now().minusDays(Math.max(days, 1) - 1);
        String keyword = (search == null || search.isBlank()) ? null : "%" + search.trim() + "%";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                WITH flow AS (
                    SELECT product_id, outbound_date AS flow_date, 0 AS in_count, outbound_count AS out_count, NULL::varchar AS warehouse
                    FROM product_outbound
                    WHERE company_id = ? AND outbound_date >= ?
                    UNION ALL
                    SELECT product_id, inbound_date AS flow_date, inbound_count AS in_count, 0 AS out_count, warehouse
                    FROM product_inbound
                    WHERE company_id = ? AND inbound_date >= ?
                )
                SELECT
                    f.flow_date,
                    p.id AS product_id,
                    p.product_name,
                    b.brand_name,
                    COALESCE(SUM(f.in_count), 0)::int AS in_count,
                    COALESCE(SUM(f.out_count), 0)::int AS out_count,
                    MAX(f.warehouse) AS warehouse
                FROM flow f
                JOIN product p ON p.id = f.product_id
                LEFT JOIN brand b ON b.id = p.brand_id
                WHERE (?::text IS NULL OR p.product_name ILIKE ?::text)
                GROUP BY f.flow_date, p.id, p.product_name, b.brand_name
                ORDER BY f.flow_date DESC, out_count DESC
                LIMIT 1000
                """, companyId, java.sql.Date.valueOf(from), companyId, java.sql.Date.valueOf(from),
                keyword, keyword);

        Map<String, Object> summary = jdbcTemplate.queryForMap("""
                SELECT
                    COALESCE((SELECT SUM(inbound_count) FROM product_inbound WHERE company_id = ? AND inbound_date >= ?), 0)::bigint AS total_in,
                    COALESCE((SELECT SUM(outbound_count) FROM product_outbound WHERE company_id = ? AND outbound_date >= ?), 0)::bigint AS total_out,
                    COALESCE((SELECT COUNT(DISTINCT product_id) FROM product_outbound WHERE company_id = ? AND outbound_date >= ?), 0)::int AS active_products
                """, companyId, java.sql.Date.valueOf(from), companyId, java.sql.Date.valueOf(from),
                companyId, java.sql.Date.valueOf(from));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("days", days);
        result.put("summary", summary);
        result.put("rows", rows);
        return result;
    }

    /** 재고 예측 — 현재고 ÷ 일평균 소진(7일/30일 가중) = 소진 예상일 */
    public Map<String, Object> getInventoryForecast(Long companyId, String search) {
        String keyword = (search == null || search.isBlank()) ? null : "%" + search.trim() + "%";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                WITH out_stats AS (
                    SELECT
                        product_id,
                        COALESCE(SUM(outbound_count) FILTER (WHERE outbound_date >= CURRENT_DATE - INTERVAL '6 day'), 0)::int AS out_7d,
                        COALESCE(SUM(outbound_count) FILTER (WHERE outbound_date >= CURRENT_DATE - INTERVAL '29 day'), 0)::int AS out_30d,
                        MAX(outbound_date) AS last_out_date
                    FROM product_outbound
                    WHERE company_id = ?
                    GROUP BY product_id
                ),
                in_stats AS (
                    SELECT product_id, MAX(inbound_date) AS last_in_date,
                           COALESCE(SUM(inbound_count) FILTER (WHERE inbound_date >= CURRENT_DATE - INTERVAL '29 day'), 0)::int AS in_30d
                    FROM product_inbound
                    WHERE company_id = ?
                    GROUP BY product_id
                )
                SELECT
                    p.id AS product_id,
                    p.product_name,
                    b.brand_name,
                    COALESCE(p.real_stock, 0) AS real_stock,
                    COALESCE(p.safe_stock, 0) AS safe_stock,
                    COALESCE(o.out_7d, 0) AS out_7d,
                    COALESCE(o.out_30d, 0) AS out_30d,
                    o.last_out_date,
                    i.last_in_date,
                    COALESCE(i.in_30d, 0) AS in_30d,
                    GREATEST(COALESCE(o.out_7d, 0) / 7.0, COALESCE(o.out_30d, 0) / 30.0) AS daily_burn,
                    CASE
                        WHEN GREATEST(COALESCE(o.out_7d, 0) / 7.0, COALESCE(o.out_30d, 0) / 30.0) > 0
                        THEN FLOOR(COALESCE(p.real_stock, 0) / GREATEST(COALESCE(o.out_7d, 0) / 7.0, COALESCE(o.out_30d, 0) / 30.0))
                        ELSE NULL
                    END AS days_left,
                    CASE
                        WHEN COALESCE(p.real_stock, 0) <= 0 THEN 'OUT'
                        WHEN GREATEST(COALESCE(o.out_7d, 0) / 7.0, COALESCE(o.out_30d, 0) / 30.0) = 0 THEN 'STALE'
                        WHEN COALESCE(p.real_stock, 0) / GREATEST(COALESCE(o.out_7d, 0) / 7.0, COALESCE(o.out_30d, 0) / 30.0) <= 7 THEN 'URGENT'
                        WHEN COALESCE(p.real_stock, 0) / GREATEST(COALESCE(o.out_7d, 0) / 7.0, COALESCE(o.out_30d, 0) / 30.0) <= 21 THEN 'WARN'
                        ELSE 'OK'
                    END AS status
                FROM product p
                LEFT JOIN brand b ON b.id = p.brand_id
                LEFT JOIN out_stats o ON o.product_id = p.id
                LEFT JOIN in_stats i ON i.product_id = p.id
                WHERE p.company_id = ?
                  AND (COALESCE(p.real_stock, 0) > 0 OR COALESCE(o.out_30d, 0) > 0 OR COALESCE(i.in_30d, 0) > 0)
                  AND (?::text IS NULL OR p.product_name ILIKE ?::text)
                ORDER BY
                    CASE
                        WHEN COALESCE(p.real_stock, 0) <= 0 AND COALESCE(o.out_30d, 0) > 0 THEN 0
                        WHEN GREATEST(COALESCE(o.out_7d, 0) / 7.0, COALESCE(o.out_30d, 0) / 30.0) > 0
                             AND COALESCE(p.real_stock, 0) / GREATEST(COALESCE(o.out_7d, 0) / 7.0, COALESCE(o.out_30d, 0) / 30.0) <= 7 THEN 1
                        WHEN GREATEST(COALESCE(o.out_7d, 0) / 7.0, COALESCE(o.out_30d, 0) / 30.0) > 0
                             AND COALESCE(p.real_stock, 0) / GREATEST(COALESCE(o.out_7d, 0) / 7.0, COALESCE(o.out_30d, 0) / 30.0) <= 21 THEN 2
                        ELSE 3
                    END,
                    out_30d DESC
                LIMIT 500
                """, companyId, companyId, companyId, keyword, keyword);

        int outCount = 0, urgent = 0, warn = 0, ok = 0, stale = 0;
        for (Map<String, Object> row : rows) {
            switch (String.valueOf(row.get("status"))) {
                case "OUT" -> outCount++;
                case "URGENT" -> urgent++;
                case "WARN" -> warn++;
                case "OK" -> ok++;
                default -> stale++;
            }
        }
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("outOfStock", outCount);
        summary.put("urgent", urgent);
        summary.put("warning", warn);
        summary.put("ok", ok);
        summary.put("stale", stale);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", summary);
        result.put("rows", rows);
        return result;
    }
}
