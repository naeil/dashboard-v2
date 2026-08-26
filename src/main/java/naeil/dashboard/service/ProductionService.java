package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 생산 관리 — 발주(생산/사입)·입고 연동·원가 추적.
 * 발주 시점: 종합 상황판 재발주 데드라인과 연동. 입고 처리 시 product_inbound 자동 기록.
 * 원가 경고: 같은 품목의 직전 발주 단가 대비 상승률이 임계치(%) 이상이면 '개선 필요'.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductionService {

    private final JdbcTemplate jdbcTemplate;

    /* ───────── 공급처 ───────── */

    public List<Map<String, Object>> getSuppliers(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT s.id, s.supplier_name, s.contact, s.payment_terms, s.lead_days, s.memo, s.is_active,
                       COALESCE(po.cnt, 0) AS order_count, po.last_order
                FROM supplier s
                LEFT JOIN (
                    SELECT supplier_id, COUNT(*)::int AS cnt, MAX(order_date) AS last_order
                    FROM purchase_order WHERE company_id = ? AND status <> 'CANCELED'
                    GROUP BY supplier_id
                ) po ON po.supplier_id = s.id
                WHERE s.company_id = ?
                ORDER BY s.is_active DESC, s.supplier_name
                """, companyId, companyId);
    }

    @Transactional
    public Map<String, Object> saveSupplier(Long companyId, Map<String, Object> p) {
        String name = str(p.get("supplierName"));
        if (name == null) return Map.of("success", false, "message", "공급처명이 필요합니다.");
        Long id = p.get("id") == null ? null : (long) num(p.get("id"));
        if (id == null) {
            jdbcTemplate.update("""
                    INSERT INTO supplier (company_id, supplier_name, contact, payment_terms, lead_days, memo, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                    ON CONFLICT (company_id, supplier_name)
                    DO UPDATE SET contact = EXCLUDED.contact, payment_terms = EXCLUDED.payment_terms,
                                  lead_days = EXCLUDED.lead_days, memo = EXCLUDED.memo, is_active = TRUE, updated_at = NOW()
                    """, companyId, name, str(p.get("contact")), str(p.get("paymentTerms")),
                    (int) Math.max(0, num(p.get("leadDays")) == 0 ? 14 : num(p.get("leadDays"))), str(p.get("memo")));
        } else {
            jdbcTemplate.update("""
                    UPDATE supplier SET supplier_name = ?, contact = ?, payment_terms = ?, lead_days = ?, memo = ?,
                           is_active = ?, updated_at = NOW()
                    WHERE company_id = ? AND id = ?
                    """, name, str(p.get("contact")), str(p.get("paymentTerms")),
                    (int) Math.max(0, num(p.get("leadDays"))), str(p.get("memo")),
                    !Boolean.FALSE.equals(p.get("isActive")), companyId, id);
        }
        return Map.of("success", true);
    }

    /* ───────── 발주서 ───────── */

    public List<Map<String, Object>> getOrders(Long companyId, String status) {
        String filter = "";
        Object[] args = new Object[]{companyId, companyId};
        if (str2(status) != null && !"ALL".equalsIgnoreCase(status)) {
            filter = " AND po.status = ? ";
            args = new Object[]{companyId, companyId, status.toUpperCase()};
        }
        List<Map<String, Object>> orders = jdbcTemplate.queryForList("""
                SELECT po.id, po.order_type, po.status, po.order_date, po.expected_date, po.received_date,
                       po.memo, po.created_by, s.supplier_name,
                       (po.status = 'ORDERED' AND po.expected_date IS NOT NULL AND po.expected_date < CURRENT_DATE) AS delayed,
                       it.item_count, it.total_qty, it.total_amount, it.item_summary
                FROM purchase_order po
                LEFT JOIN supplier s ON s.id = po.supplier_id
                LEFT JOIN (
                    SELECT po_id, COUNT(*)::int AS item_count, SUM(qty)::int AS total_qty,
                           ROUND(SUM(amount), 0) AS total_amount,
                           STRING_AGG(item_name || ' x' || qty, ', ' ORDER BY id) AS item_summary
                    FROM purchase_order_item WHERE company_id = ?
                    GROUP BY po_id
                ) it ON it.po_id = po.id
                WHERE po.company_id = ?
                """ + filter + """
                ORDER BY CASE WHEN po.status = 'ORDERED' THEN 0 ELSE 1 END, po.expected_date NULLS LAST, po.id DESC
                LIMIT 200
                """, args);
        return orders;
    }

    public List<Map<String, Object>> getOrderItems(Long companyId, long poId) {
        return jdbcTemplate.queryForList("""
                SELECT id, product_id, item_name, qty, unit_price, amount
                FROM purchase_order_item WHERE company_id = ? AND po_id = ? ORDER BY id
                """, companyId, poId);
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> createOrder(Long companyId, Map<String, Object> p, String createdBy) {
        Object itemsObj = p.get("items");
        if (!(itemsObj instanceof List<?> itemsRaw) || itemsRaw.isEmpty()) {
            return Map.of("success", false, "message", "발주 품목이 필요합니다.");
        }
        Long supplierId = null;
        String supplierName = str(p.get("supplierName"));
        if (supplierName != null) {
            jdbcTemplate.update("""
                    INSERT INTO supplier (company_id, supplier_name) VALUES (?, ?)
                    ON CONFLICT (company_id, supplier_name) DO NOTHING
                    """, companyId, supplierName);
            supplierId = jdbcTemplate.queryForObject(
                    "SELECT id FROM supplier WHERE company_id = ? AND supplier_name = ?", Long.class, companyId, supplierName);
        }
        String orderType = "PURCHASE".equalsIgnoreCase(str2(p.get("orderType"))) ? "PURCHASE" : "PRODUCTION";
        java.sql.Date orderDate = dateOr(p.get("orderDate"), LocalDate.now());
        java.sql.Date expected = dateOr(p.get("expectedDate"), null);

        jdbcTemplate.update("""
                INSERT INTO purchase_order (company_id, supplier_id, order_type, status, order_date, expected_date, memo, created_by)
                VALUES (?, ?, ?, 'ORDERED', ?, ?, ?, ?)
                """, companyId, supplierId, orderType, orderDate, expected, str(p.get("memo")), createdBy);
        Long poId = jdbcTemplate.queryForObject(
                "SELECT id FROM purchase_order WHERE company_id = ? ORDER BY id DESC LIMIT 1", Long.class, companyId);

        Map<String, Long> productByNorm = productMap(companyId);
        int saved = 0;
        for (Object o : itemsRaw) {
            Map<String, Object> it = (Map<String, Object>) o;
            String itemName = str(it.get("itemName"));
            long qty = num(it.get("qty"));
            if (itemName == null || qty <= 0) continue;
            BigDecimal unitPrice = dec(it.get("unitPrice"));
            Long productId = matchProduct(productByNorm, itemName);
            jdbcTemplate.update("""
                    INSERT INTO purchase_order_item (po_id, company_id, product_id, item_name, qty, unit_price, amount)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, poId, companyId, productId, itemName, (int) qty, unitPrice,
                    unitPrice.multiply(BigDecimal.valueOf(qty)));
            saved++;
        }
        if (saved == 0) {
            return Map.of("success", false, "message", "유효한 품목이 없습니다.");
        }
        return Map.of("success", true, "poId", poId);
    }

    /** 입고 처리: 상태 RECEIVED + 상품 매칭된 품목은 product_inbound 자동 기록 */
    @Transactional
    public Map<String, Object> receiveOrder(Long companyId, long poId, String receivedDateStr) {
        java.sql.Date receivedDate = dateOr(receivedDateStr, LocalDate.now());
        int n = jdbcTemplate.update("""
                UPDATE purchase_order SET status = 'RECEIVED', received_date = ?, updated_at = NOW()
                WHERE company_id = ? AND id = ? AND status = 'ORDERED'
                """, receivedDate, companyId, poId);
        if (n == 0) return Map.of("success", false, "message", "입고 처리할 발주가 없습니다.");
        int inbound = 0;
        for (Map<String, Object> it : getOrderItems(companyId, poId)) {
            if (it.get("product_id") == null) continue;
            long productId = ((Number) it.get("product_id")).longValue();
            Long brandId = jdbcTemplate.queryForObject(
                    "SELECT brand_id FROM product WHERE id = ?", Long.class, productId);
            jdbcTemplate.update("""
                    INSERT INTO product_inbound (company_id, product_id, brand_id, inbound_date, inbound_count, warehouse, memo)
                    VALUES (?, ?, ?, ?, ?, '발주입고', ?)
                    ON CONFLICT (company_id, product_id, inbound_date, warehouse)
                    DO UPDATE SET inbound_count = product_inbound.inbound_count + EXCLUDED.inbound_count, updated_at = NOW()
                    """, companyId, productId, brandId, receivedDate,
                    ((Number) it.get("qty")).intValue(), "발주 #" + poId);
            inbound++;
        }
        return Map.of("success", true, "inboundRecorded", inbound);
    }

    @Transactional
    public Map<String, Object> cancelOrder(Long companyId, long poId) {
        int n = jdbcTemplate.update(
                "UPDATE purchase_order SET status = 'CANCELED', updated_at = NOW() WHERE company_id = ? AND id = ? AND status = 'ORDERED'",
                companyId, poId);
        return Map.of("success", n > 0);
    }

    /* ───────── 원가 추적 ───────── */

    public Map<String, Object> getCostTrend(Long companyId) {
        double alertPct = ((Number) getConfig(companyId).get("price_alert_pct")).doubleValue();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT i.item_name, po.order_date, i.unit_price, i.qty, s.supplier_name
                FROM purchase_order_item i
                JOIN purchase_order po ON po.id = i.po_id
                LEFT JOIN supplier s ON s.id = po.supplier_id
                WHERE i.company_id = ? AND po.status <> 'CANCELED' AND i.unit_price > 0
                ORDER BY i.item_name, po.order_date, i.id
                """, companyId);

        Map<String, List<Map<String, Object>>> byItem = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            byItem.computeIfAbsent(String.valueOf(r.get("item_name")), k -> new ArrayList<>()).add(r);
        }
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map.Entry<String, List<Map<String, Object>>> e : byItem.entrySet()) {
            List<Map<String, Object>> hist = e.getValue();
            Map<String, Object> last = hist.get(hist.size() - 1);
            double lastPrice = ((Number) last.get("unit_price")).doubleValue();
            Double prevPrice = hist.size() > 1
                    ? ((Number) hist.get(hist.size() - 2).get("unit_price")).doubleValue() : null;
            Double changePct = prevPrice != null && prevPrice > 0
                    ? Math.round((lastPrice - prevPrice) * 1000.0 / prevPrice) / 10.0 : null;
            double minPrice = hist.stream().mapToDouble(h -> ((Number) h.get("unit_price")).doubleValue()).min().orElse(lastPrice);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("itemName", e.getKey());
            item.put("lastPrice", Math.round(lastPrice));
            item.put("prevPrice", prevPrice == null ? null : Math.round(prevPrice));
            item.put("changePct", changePct);
            item.put("minPrice", Math.round(minPrice));
            item.put("orderCount", hist.size());
            item.put("lastDate", String.valueOf(last.get("order_date")));
            item.put("lastSupplier", last.get("supplier_name"));
            item.put("alert", changePct != null && changePct >= alertPct);
            item.put("history", hist.stream().map(h -> Map.of(
                    "date", String.valueOf(h.get("order_date")),
                    "price", Math.round(((Number) h.get("unit_price")).doubleValue()),
                    "supplier", h.get("supplier_name") == null ? "" : h.get("supplier_name"))).toList());
            items.add(item);
        }
        items.sort((a, b) -> Boolean.compare(
                !Boolean.TRUE.equals(a.get("alert")), !Boolean.TRUE.equals(b.get("alert"))));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("alertPct", alertPct);
        result.put("items", items);
        result.put("alertCount", items.stream().filter(i -> Boolean.TRUE.equals(i.get("alert"))).count());
        return result;
    }

    public Map<String, Object> getConfig(Long companyId) {
        return jdbcTemplate.queryForMap(
                "SELECT price_alert_pct FROM production_config WHERE company_id = ?", companyId);
    }

    @Transactional
    public Map<String, Object> saveConfig(Long companyId, Map<String, Object> p) {
        jdbcTemplate.update(
                "UPDATE production_config SET price_alert_pct = ?, updated_at = NOW() WHERE company_id = ?",
                dec(p.get("priceAlertPct")), companyId);
        return getConfig(companyId);
    }

    /* ───────── 요약 ───────── */

    public Map<String, Object> getSummary(Long companyId) {
        Map<String, Object> counts = jdbcTemplate.queryForMap("""
                SELECT COUNT(*) FILTER (WHERE status = 'ORDERED')::int AS waiting,
                       COUNT(*) FILTER (WHERE status = 'ORDERED' AND expected_date IS NOT NULL AND expected_date < CURRENT_DATE)::int AS delayed
                FROM purchase_order WHERE company_id = ?
                """, companyId);
        Map<String, Object> result = new LinkedHashMap<>(counts);
        result.put("alertCount", getCostTrend(companyId).get("alertCount"));
        return result;
    }

    /* ───────── 내부 ───────── */

    private Map<String, Long> productMap(Long companyId) {
        Map<String, Long> byNorm = new HashMap<>();
        for (Map<String, Object> p : jdbcTemplate.queryForList(
                "SELECT id, product_name FROM product WHERE company_id = ?", companyId)) {
            byNorm.putIfAbsent(norm(String.valueOf(p.get("product_name"))), ((Number) p.get("id")).longValue());
        }
        return byNorm;
    }

    private static Long matchProduct(Map<String, Long> byNorm, String name) {
        String n = norm(name);
        if (byNorm.containsKey(n)) return byNorm.get(n);
        Long best = null;
        int bestLen = Integer.MAX_VALUE;
        for (Map.Entry<String, Long> e : byNorm.entrySet()) {
            if ((e.getKey().contains(n) || n.contains(e.getKey())) && e.getKey().length() < bestLen && e.getKey().length() >= 3) {
                best = e.getValue();
                bestLen = e.getKey().length();
            }
        }
        return best;
    }

    private static String norm(String v) {
        return v == null ? "" : v.toLowerCase().replaceAll("[^0-9a-z가-힣]+", "");
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static String str2(Object v) { return str(v); }

    private static long num(Object v) {
        if (v == null) return 0L;
        try { return new BigDecimal(String.valueOf(v).replaceAll("[₩,\\s원]", "")).longValue(); }
        catch (Exception e) { return 0L; }
    }

    private static BigDecimal dec(Object v) {
        if (v == null) return BigDecimal.ZERO;
        try { return new BigDecimal(String.valueOf(v).replaceAll("[₩,\\s원]", "")); }
        catch (Exception e) { return BigDecimal.ZERO; }
    }

    private static java.sql.Date dateOr(Object v, LocalDate fallback) {
        try { return java.sql.Date.valueOf(LocalDate.parse(String.valueOf(v).substring(0, 10))); }
        catch (Exception e) { return fallback == null ? null : java.sql.Date.valueOf(fallback); }
    }
}
