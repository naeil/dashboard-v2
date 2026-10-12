package naeil.dashboard.service;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.common.order.OrderStatusGroups;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 관제 에이전트(B)용 읽기 전용 상태 요약.
 * 섹션별로 독립 실행해서 한 섹션의 오류(테이블 미사용 등)가 전체 요약을 막지 않게 한다.
 * 고객 개인정보(이름·연락처·문의 본문)는 내보내지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentMonitorService {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private final JdbcTemplate jdbcTemplate;

    public Map<String, Object> statusSummary(Long companyId) {
        ZonedDateTime now = ZonedDateTime.now(SEOUL);
        ZonedDateTime dayStart = now.toLocalDate().atStartOfDay(SEOUL);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("generatedAt", now.toOffsetDateTime().toString());
        out.put("agents", section("agents", () -> jdbcTemplate.queryForList("""
                SELECT agent_name, status_text, host, last_seen_at,
                       ROUND(EXTRACT(EPOCH FROM (NOW() - last_seen_at)) / 60) AS minutes_since
                FROM agent_heartbeat WHERE company_id = ? ORDER BY agent_name
                """, companyId)));
        out.put("orders", section("orders", () -> orders(companyId, now, dayStart)));
        out.put("stock", section("stock", () -> stock(companyId)));
        out.put("cs", section("cs", () -> cs(companyId)));
        out.put("approvals", section("approvals", () -> jdbcTemplate.queryForMap("""
                SELECT COUNT(*) FILTER (WHERE status = 'PENDING_APPROVAL') AS pending,
                       COUNT(*) FILTER (WHERE status = 'FAILED' AND updated_at > NOW() - INTERVAL '24 hours') AS failed_24h
                FROM agent_activity WHERE company_id = ?
                """, companyId)));
        return out;
    }

    /**
     * AI 관제실 화면용: 상태 요약 + 시간대별 그래프 데이터.
     * - ordersHourly: 오늘 시간대별 주문 수 vs 최근 4주 같은 요일 평균
     * - activityHourly: 최근 24시간 에이전트별 활동 수(시간 단위)
     * - activityByKind: 오늘 활동 종류별 건수
     */
    public Map<String, Object> controlRoom(Long companyId) {
        ZonedDateTime now = ZonedDateTime.now(SEOUL);
        ZonedDateTime dayStart = now.toLocalDate().atStartOfDay(SEOUL);
        Map<String, Object> out = statusSummary(companyId);
        out.put("ordersHourly", section("ordersHourly", () -> ordersHourly(companyId, dayStart)));
        out.put("activityHourly", section("activityHourly", () -> jdbcTemplate.queryForList("""
                SELECT agent_name, DATE_TRUNC('hour', created_at) AS hour, COUNT(*) AS count
                FROM agent_activity
                WHERE company_id = ? AND created_at > NOW() - INTERVAL '24 hours'
                GROUP BY agent_name, DATE_TRUNC('hour', created_at)
                ORDER BY hour
                """, companyId)));
        out.put("activityByKind", section("activityByKind", () -> jdbcTemplate.queryForList("""
                SELECT kind, status, COUNT(*) AS count
                FROM agent_activity
                WHERE company_id = ? AND created_at >= ?
                GROUP BY kind, status
                """, companyId, dayStart.toOffsetDateTime())));
        out.put("boards", section("boards", () -> jdbcTemplate.queryForList("""
                SELECT agent_name, board_key, payload::text AS payload, updated_at
                FROM agent_board WHERE company_id = ? ORDER BY agent_name, board_key
                """, companyId)));
        return out;
    }

    private Map<String, Object> ordersHourly(Long companyId, ZonedDateTime dayStart) {
        String statuses = revenueStatuses();
        String hour = "EXTRACT(HOUR FROM o.ord_time AT TIME ZONE 'Asia/Seoul')::int";
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("today", jdbcTemplate.queryForList(
                "SELECT " + hour + " AS h, COUNT(*) AS count FROM orders o"
                        + " WHERE o.company_id = ? AND o.ord_status IN (" + statuses + ")"
                        + " AND o.ord_time >= ? AND o.ord_time < ? GROUP BY 1 ORDER BY 1",
                companyId, dayStart.toOffsetDateTime(), dayStart.plusDays(1).toOffsetDateTime()));
        m.put("sameWeekdayAvg", jdbcTemplate.queryForList(
                "SELECT " + hour + " AS h, COUNT(*) / 4.0 AS count"
                        + " FROM generate_series(1, 4) w"
                        + " JOIN orders o ON o.company_id = ? AND o.ord_status IN (" + statuses + ")"
                        + "  AND o.ord_time >= (?::timestamptz - (w * INTERVAL '7 days'))"
                        + "  AND o.ord_time <  (?::timestamptz - (w * INTERVAL '7 days'))"
                        + " GROUP BY 1 ORDER BY 1",
                companyId, dayStart.toOffsetDateTime(), dayStart.plusDays(1).toOffsetDateTime()));
        return m;
    }

    private static String revenueStatuses() {
        return String.join(",", OrderStatusGroups.REVENUE_INCLUDED_STATUSES.stream()
                .map(s -> "'" + s.replace("'", "''") + "'").toList());
    }

    private Map<String, Object> orders(Long companyId, ZonedDateTime now, ZonedDateTime dayStart) {
        String statuses = revenueStatuses();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("lastCollectedAt", jdbcTemplate.queryForObject(
                "SELECT MAX(created_at) FROM orders WHERE company_id = ?", Object.class, companyId));
        m.put("today", jdbcTemplate.queryForMap(
                "SELECT COUNT(*) AS orders, COALESCE(SUM(pay_amt), 0) AS sales FROM orders "
                        + "WHERE company_id = ? AND ord_time >= ? AND ord_time < ? AND ord_status IN (" + statuses + ")",
                companyId, dayStart.toOffsetDateTime(), now.toOffsetDateTime()));
        // 최근 4주 같은 요일, 같은 시각까지의 평균 (시간대 보정 비교용)
        m.put("sameWeekdayAvg", jdbcTemplate.queryForMap(
                "SELECT COALESCE(AVG(cnt), 0) AS orders, COALESCE(AVG(amt), 0) AS sales FROM ("
                        + " SELECT w, COUNT(o.sku_cd) AS cnt, COALESCE(SUM(o.pay_amt), 0) AS amt"
                        + " FROM generate_series(1, 4) w"
                        + " LEFT JOIN orders o ON o.company_id = ? AND o.ord_status IN (" + statuses + ")"
                        + "  AND o.ord_time >= (?::timestamptz - (w * INTERVAL '7 days'))"
                        + "  AND o.ord_time <  (?::timestamptz - (w * INTERVAL '7 days'))"
                        + " GROUP BY w) t",
                companyId, dayStart.toOffsetDateTime(), now.toOffsetDateTime()));
        return m;
    }

    private Map<String, Object> stock(Long companyId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("outOfStock", jdbcTemplate.queryForList("""
                SELECT product_name, sku_cd, real_stock FROM product
                WHERE company_id = ? AND real_stock <= 0 ORDER BY product_name LIMIT 20
                """, companyId));
        m.put("belowSafeStock", jdbcTemplate.queryForList("""
                SELECT product_name, sku_cd, real_stock, safe_stock FROM product
                WHERE company_id = ? AND real_stock > 0 AND safe_stock > 0 AND real_stock <= safe_stock
                ORDER BY real_stock LIMIT 20
                """, companyId));
        return m;
    }

    private Map<String, Object> cs(Long companyId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("unansweredInquiries", section("inquiry", () -> jdbcTemplate.queryForMap("""
                SELECT COUNT(*) AS count, MIN(received_at) AS oldest
                FROM executive_customer_inquiry WHERE company_id = ? AND status = 'UNANSWERED'
                """, companyId)));
        m.put("newCsInquiries", section("cs_inquiries", () -> jdbcTemplate.queryForMap("""
                SELECT COUNT(*) AS count, MIN(created_at) AS oldest FROM cs_inquiries WHERE status = 'NEW'
                """)));
        m.put("lowRatingReviews24h", section("reviews", () -> jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM ai_reviews
                WHERE rating <= 2 AND COALESCE(review_date, created_at) > NOW() - INTERVAL '24 hours'
                """, Long.class)));
        return m;
    }

    private Object section(String name, Supplier<Object> supplier) {
        try {
            return supplier.get();
        } catch (Exception e) {
            log.warn("관제 요약 섹션 실패 [{}]: {}", name, e.getMessage());
            return Map.of("error", "조회 실패");
        }
    }
}
