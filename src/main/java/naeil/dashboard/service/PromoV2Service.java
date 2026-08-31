package naeil.dashboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 프로모션 행사 설계 v2 — 저장/조회는 원본 입력값만 다루고, 마진 계산은 프론트에서
 * 기능정의서 5장 계산식으로 수행한다 (모든 금액은 세전 통일).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PromoV2Service {

    private static final Long DEFAULT_COMPANY_ID = 1L;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<Map<String, Object>> getChannelDefaults() {
        return jdbcTemplate.queryForList(
                "SELECT channel_name, fee_rate, ad_rate, sga_rate, shipping_cost FROM promo_channel_default ORDER BY channel_name");
    }

    /** 상품 드롭다운: PlayAuto/직연동 상품 + 원가 마스터(제품 원가 관리) 매칭 */
    public List<Map<String, Object>> searchProducts(String q) {
        String keyword = (q == null || q.isBlank()) ? null : "%" + q.trim() + "%";
        return jdbcTemplate.queryForList("""
                SELECT
                    p.id,
                    p.product_name,
                    COALESCE(CAST(p.prod_no AS TEXT), p.sku_cd, CAST(p.id AS TEXT)) AS product_code,
                    COALESCE((
                        SELECT e.production_cost
                        FROM executive_product_profit e
                        WHERE e.company_id = p.company_id
                          AND (e.sku = p.sku_cd
                               OR p.product_name ILIKE CONCAT('%', e.product_name, '%')
                               OR e.product_name ILIKE CONCAT('%', p.product_name, '%'))
                        ORDER BY LENGTH(e.product_name) DESC
                        LIMIT 1
                    ), 0) AS unit_cost
                FROM product p
                WHERE p.company_id = ?
                  AND (?::text IS NULL OR p.product_name ILIKE ?::text OR p.sku_cd ILIKE ?::text)
                ORDER BY p.product_name
                LIMIT 300
                """, DEFAULT_COMPANY_ID, keyword, keyword, keyword);
    }

    public List<Map<String, Object>> listEvents(String month, String brand, String channel) {
        LocalDate monthStart;
        LocalDate monthEnd;
        try {
            YearMonth ym = YearMonth.parse(month);
            monthStart = ym.atDay(1);
            monthEnd = ym.atEndOfMonth();
        } catch (Exception e) {
            YearMonth ym = YearMonth.now();
            monthStart = ym.atDay(1);
            monthEnd = ym.atEndOfMonth();
        }
        String brandKeyword = (brand == null || brand.isBlank()) ? null : brand;
        String channelKeyword = (channel == null || channel.isBlank()) ? null : channel;
        List<Map<String, Object>> events = jdbcTemplate.queryForList("""
                SELECT * FROM promo_event
                WHERE company_id = ?
                  AND start_date <= ? AND end_date >= ?
                  AND (?::text IS NULL OR brand_name = ?::text)
                  AND (?::text IS NULL OR channel_name = ?::text)
                ORDER BY is_always_on ASC, start_date ASC, id ASC
                """, DEFAULT_COMPANY_ID, Date.valueOf(monthEnd), Date.valueOf(monthStart),
                brandKeyword, brandKeyword, channelKeyword, channelKeyword);
        for (Map<String, Object> event : events) {
            attachChildren(event);
        }
        return events;
    }

    public Map<String, Object> getEvent(Long id) {
        Map<String, Object> event = jdbcTemplate.queryForMap(
                "SELECT * FROM promo_event WHERE id = ? AND company_id = ?", id, DEFAULT_COMPANY_ID);
        attachChildren(event);
        return event;
    }

    private void attachChildren(Map<String, Object> event) {
        Long eventId = ((Number) event.get("id")).longValue();
        List<Map<String, Object>> blocks = jdbcTemplate.queryForList(
                "SELECT * FROM promo_block WHERE event_id = ? ORDER BY sort_order, id", eventId);
        for (Map<String, Object> block : blocks) {
            Long blockId = ((Number) block.get("id")).longValue();
            List<Map<String, Object>> options = jdbcTemplate.queryForList(
                    "SELECT * FROM promo_option WHERE block_id = ? ORDER BY sort_order, id", blockId);
            for (Map<String, Object> option : options) {
                Object benefit = option.get("benefit");
                if (benefit != null) {
                    try {
                        option.put("benefit", objectMapper.readValue(benefit.toString(), Map.class));
                    } catch (Exception e) {
                        option.put("benefit", new LinkedHashMap<>());
                    }
                }
            }
            block.put("options", options);
        }
        event.put("blocks", blocks);
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public Long saveEvent(Long id, Map<String, Object> p) {
        String brand = str(p.get("brandName"));
        String channelName = str(p.get("channelName"));
        String title = str(p.get("title"));
        if (brand == null || channelName == null || title == null) {
            throw new IllegalArgumentException("브랜드, 채널, 행사명은 필수입니다.");
        }
        LocalDate startDate = parseDate(p.get("startDate"));
        LocalDate endDate = parseDate(p.get("endDate"));
        if (startDate == null || endDate == null || endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("행사 기간이 올바르지 않습니다.");
        }
        long fixedCost = num(p.get("fixedCost"));
        Long eventId = id;
        if (eventId == null) {
            KeyHolder keyHolder = new GeneratedKeyHolder();
            jdbcTemplate.update(con -> {
                PreparedStatement ps = con.prepareStatement("""
                        INSERT INTO promo_event
                        (company_id, brand_name, channel_name, title, start_date, end_date, promo_type, is_always_on,
                         status, fee_rate, ad_rate, sga_rate, shipping_cost, fixed_cost, target_margin_rate, expected_orders,
                         expected_revenue, target_revenue, created_by)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                        """, Statement.RETURN_GENERATED_KEYS);
                fillEventParams(ps, brand, channelName, title, startDate, endDate, p, fixedCost);
                ps.setLong(17, num(p.get("expectedRevenue")));
                ps.setLong(18, num(p.get("targetRevenue")));
                ps.setString(19, str(p.getOrDefault("createdBy", "")));
                return ps;
            }, keyHolder);
            Map<String, Object> keys = keyHolder.getKeys();
            eventId = ((Number) (keys != null && keys.containsKey("id") ? keys.get("id") : keyHolder.getKey())).longValue();
        } else {
            Long finalId = eventId;
            jdbcTemplate.update(con -> {
                PreparedStatement ps = con.prepareStatement("""
                        UPDATE promo_event SET
                          company_id = company_id, brand_name = ?, channel_name = ?, title = ?, start_date = ?, end_date = ?,
                          promo_type = ?, is_always_on = ?, status = ?, fee_rate = ?, ad_rate = ?, sga_rate = ?,
                          shipping_cost = ?, fixed_cost = ?, target_margin_rate = ?, expected_orders = ?,
                          expected_revenue = ?, target_revenue = ?, updated_at = NOW()
                        WHERE id = ?
                        """);
                fillEventParamsForUpdate(ps, brand, channelName, title, startDate, endDate, p, fixedCost);
                ps.setLong(16, num(p.get("expectedRevenue")));
                ps.setLong(17, num(p.get("targetRevenue")));
                ps.setLong(18, finalId);
                return ps;
            });
            jdbcTemplate.update("DELETE FROM promo_block WHERE event_id = ?", eventId);
        }

        final long evId = eventId;
        List<Map<String, Object>> blocks = (List<Map<String, Object>>) p.getOrDefault("blocks", List.of());
        int blockOrder = 0;
        for (Map<String, Object> block : blocks) {
            String productCode = str(block.get("productCode"));
            if (productCode == null) continue;
            KeyHolder blockKey = new GeneratedKeyHolder();
            int order = blockOrder++;
            String productName = str(block.getOrDefault("productName", ""));
            jdbcTemplate.update(con -> {
                PreparedStatement ps = con.prepareStatement(
                        "INSERT INTO promo_block (event_id, product_code, product_name, sort_order) VALUES (?,?,?,?)",
                        Statement.RETURN_GENERATED_KEYS);
                ps.setLong(1, evId);
                ps.setString(2, productCode);
                ps.setString(3, productName);
                ps.setInt(4, order);
                return ps;
            }, blockKey);
            Map<String, Object> blockKeys = blockKey.getKeys();
            long blockId = ((Number) (blockKeys != null && blockKeys.containsKey("id") ? blockKeys.get("id") : blockKey.getKey())).longValue();
            List<Map<String, Object>> options = (List<Map<String, Object>>) block.getOrDefault("options", List.of());
            int optionOrder = 0;
            for (Map<String, Object> option : options) {
                String optionName = str(option.get("optionName"));
                if (optionName == null) continue;
                String benefitJson;
                try {
                    benefitJson = objectMapper.writeValueAsString(option.getOrDefault("benefit", Map.of()));
                } catch (Exception e) {
                    benefitJson = "{}";
                }
                jdbcTemplate.update("""
                        INSERT INTO promo_option
                        (block_id, option_name, unit_cost, unit_cost_overridden, master_unit_cost, list_price, benefit, mix_rate, sort_order)
                        VALUES (?,?,?,?,?,?,?::jsonb,?,?)
                        """,
                        blockId, optionName, num(option.get("unitCost")),
                        Boolean.TRUE.equals(option.get("unitCostOverridden")),
                        option.get("masterUnitCost") == null ? null : num(option.get("masterUnitCost")),
                        num(option.get("listPrice")), benefitJson,
                        dec(option.get("mixRate")), optionOrder++);
            }
        }
        return eventId;
    }

    private void fillEventParams(PreparedStatement ps, String brand, String channelName, String title,
                                 LocalDate startDate, LocalDate endDate, Map<String, Object> p, long fixedCost) throws java.sql.SQLException {
        ps.setLong(1, DEFAULT_COMPANY_ID);
        ps.setString(2, brand);
        ps.setString(3, channelName);
        ps.setString(4, title);
        ps.setDate(5, Date.valueOf(startDate));
        ps.setDate(6, Date.valueOf(endDate));
        ps.setString(7, str(p.getOrDefault("promoType", "")));
        ps.setBoolean(8, Boolean.TRUE.equals(p.get("isAlwaysOn")));
        ps.setString(9, str(p.getOrDefault("status", "기획")) == null ? "기획" : str(p.getOrDefault("status", "기획")));
        ps.setBigDecimal(10, dec(p.get("feeRate")));
        ps.setBigDecimal(11, dec(p.get("adRate")));
        ps.setBigDecimal(12, dec(p.get("sgaRate")));
        ps.setInt(13, (int) num(p.get("shippingCost")));
        ps.setLong(14, fixedCost);
        ps.setBigDecimal(15, dec(p.getOrDefault("targetMarginRate", 20)));
        ps.setInt(16, (int) num(p.get("expectedOrders")));
    }

    private void fillEventParamsForUpdate(PreparedStatement ps, String brand, String channelName, String title,
                                          LocalDate startDate, LocalDate endDate, Map<String, Object> p, long fixedCost) throws java.sql.SQLException {
        ps.setString(1, brand);
        ps.setString(2, channelName);
        ps.setString(3, title);
        ps.setDate(4, Date.valueOf(startDate));
        ps.setDate(5, Date.valueOf(endDate));
        ps.setString(6, str(p.getOrDefault("promoType", "")));
        ps.setBoolean(7, Boolean.TRUE.equals(p.get("isAlwaysOn")));
        ps.setString(8, str(p.getOrDefault("status", "기획")) == null ? "기획" : str(p.getOrDefault("status", "기획")));
        ps.setBigDecimal(9, dec(p.get("feeRate")));
        ps.setBigDecimal(10, dec(p.get("adRate")));
        ps.setBigDecimal(11, dec(p.get("sgaRate")));
        ps.setInt(12, (int) num(p.get("shippingCost")));
        ps.setLong(13, fixedCost);
        ps.setBigDecimal(14, dec(p.getOrDefault("targetMarginRate", 20)));
        ps.setInt(15, (int) num(p.get("expectedOrders")));
    }

    public void updateStatus(Long id, String status) {
        jdbcTemplate.update("UPDATE promo_event SET status = ?, updated_at = NOW() WHERE id = ? AND company_id = ?",
                status, id, DEFAULT_COMPANY_ID);
    }

    public void deleteEvent(Long id) {
        jdbcTemplate.update("DELETE FROM promo_event WHERE id = ? AND company_id = ?", id, DEFAULT_COMPANY_ID);
    }

    /** 행사 매핑 상품코드의 기간 내 실판매 합계 (직연동 orders — 취소 차감) */
    public Map<String, Object> getRealtimeSales(Long id) {
        Map<String, Object> event = jdbcTemplate.queryForMap(
                "SELECT start_date, end_date FROM promo_event WHERE id = ? AND company_id = ?", id, DEFAULT_COMPANY_ID);
        List<String> codes = jdbcTemplate.queryForList(
                "SELECT product_code FROM promo_block WHERE event_id = ?", String.class, id);
        if (codes.isEmpty()) {
            return Map.of("salesAmount", 0, "orderCount", 0);
        }
        StringBuilder placeholders = new StringBuilder();
        List<Object> params = new ArrayList<>();
        params.add(DEFAULT_COMPANY_ID);
        for (int i = 0; i < codes.size(); i++) {
            if (i > 0) placeholders.append(",");
            placeholders.append("?");
        }
        params.addAll(codes);
        params.addAll(codes);
        params.add(event.get("start_date"));
        params.add(event.get("end_date"));
        Map<String, Object> row = jdbcTemplate.queryForMap("""
                SELECT COALESCE(SUM(o.pay_amt - COALESCE(o.cancel_amt, 0)), 0) AS sales_amount,
                       COUNT(*)::int AS order_count
                FROM orders o
                JOIN product p ON p.id = o.product_id
                WHERE o.company_id = ?
                  AND (CAST(p.prod_no AS TEXT) IN (%s) OR p.sku_cd IN (%s))
                  AND COALESCE(o.pay_time, o.ord_time)::date BETWEEN ? AND ?
                """.formatted(placeholders, placeholders), params.toArray());
        return Map.of(
                "salesAmount", row.getOrDefault("sales_amount", 0),
                "orderCount", row.getOrDefault("order_count", 0));
    }

    /** 여러 행사의 기간 내 실판매 일괄 조회 — 목록·상태보드에서 BPE 달성률 표시용 */
    public List<Map<String, Object>> getRealtimeBatch(List<Long> ids) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long eventId : ids) {
            try {
                Map<String, Object> row = getRealtimeSales(eventId);
                out.add(Map.of("eventId", eventId,
                        "salesAmount", row.getOrDefault("salesAmount", 0),
                        "orderCount", row.getOrDefault("orderCount", 0)));
            } catch (Exception e) {
                out.add(Map.of("eventId", eventId, "salesAmount", 0, "orderCount", 0));
            }
        }
        return out;
    }

    private static LocalDate parseDate(Object value) {
        if (value == null) return null;
        try {
            return LocalDate.parse(String.valueOf(value).trim());
        } catch (Exception e) {
            return null;
        }
    }

    private static String str(Object value) {
        if (value == null) return null;
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    private static long num(Object value) {
        if (value == null) return 0L;
        try {
            return new BigDecimal(String.valueOf(value)).longValue();
        } catch (Exception e) {
            return 0L;
        }
    }

    private static BigDecimal dec(Object value) {
        if (value == null) return BigDecimal.ZERO;
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }
}
