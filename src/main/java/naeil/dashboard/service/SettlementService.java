package naeil.dashboard.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SettlementService {

    private final JdbcTemplate jdbc;

    /**
     * 채널별 실시간 매출 + 정산 예정 조회
     * online_channel_performance 테이블 기반으로 집계
     * 실제 컬럼: performance_month, channel_name, sales_amount, commission_cost, advertising_cost, logistics_cost, etc.
     */
    public List<Map<String, Object>> getRealtimeSales(Long companyId, String channel,
            LocalDate startDate, LocalDate endDate) {
        LocalDate sDate = startDate != null ? startDate : LocalDate.now().minusMonths(3);
        LocalDate eDate = endDate != null ? endDate : LocalDate.now();
        String sMonth = sDate.toString().substring(0, 7); // YYYY-MM
        String eMonth = eDate.toString().substring(0, 7);

        StringBuilder sql = new StringBuilder("""
            SELECT
                ocp.channel_name                           AS channel,
                ocp.performance_month                      AS order_date,
                ocp.performance_month                      AS payment_date,
                NULL                                       AS delivery_completed_date,
                NULL                                       AS purchase_confirmed_date,
                0                                          AS order_count,
                0                                          AS sales_quantity,
                COALESCE(ocp.sales_amount, 0)              AS gross_revenue,
                0                                          AS cancel_amount,
                0                                          AS return_amount,
                0                                          AS discount_amount,
                COALESCE(ocp.logistics_cost, 0)            AS shipping_fee,
                COALESCE(ocp.commission_cost, 0)           AS platform_fee,
                COALESCE(ocp.advertising_cost, 0)          AS ad_cost,
                COALESCE(ocp.sales_amount, 0) - COALESCE(ocp.commission_cost, 0) - COALESCE(ocp.logistics_cost, 0) AS settlement_base_amount,
                COALESCE(ocp.sales_amount, 0) - COALESCE(ocp.commission_cost, 0) - COALESCE(ocp.logistics_cost, 0) - COALESCE(ocp.advertising_cost, 0) AS expected_settlement_amount,
                NULL                                       AS expected_deposit_date,
                'PENDING'                                  AS settlement_status
            FROM online_channel_performance ocp
            WHERE ocp.performance_month >= ? AND ocp.performance_month <= ?
            """);
        List<Object> params = new ArrayList<>();
        params.add(sMonth);
        params.add(eMonth);
        if (channel != null && !channel.isBlank()) {
            sql.append(" AND LOWER(ocp.channel_name) LIKE LOWER(?) ");
            params.add("%" + channel + "%");
        }
        sql.append(" ORDER BY ocp.performance_month DESC LIMIT 200");
        try {
            return jdbc.queryForList(sql.toString(), params.toArray());
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * 거래처별 정산 예정 목록 조회
     * executive_settlement_schedule 테이블 (기존 settlement-schedules CRUD용)
     */
    public List<Map<String, Object>> getExpectedSettlements(Long companyId, LocalDate startDate,
            LocalDate endDate, String channel, String status) {
        LocalDate sDate = startDate != null ? startDate : LocalDate.now().withDayOfMonth(1);
        LocalDate eDate = endDate != null ? endDate : LocalDate.now().plusMonths(2);

        StringBuilder sql = new StringBuilder("""
            SELECT
                id,
                partner_name   AS vendor_name,
                settlement_type AS type,
                channel_name   AS channel,
                brand_name,
                sale_date      AS sales_date,
                settlement_due_date AS expected_settlement_date,
                expected_amount     AS expected_deposit_amount,
                actual_amount       AS actual_deposit_amount,
                CASE
                    WHEN actual_amount IS NOT NULL
                    THEN actual_amount - COALESCE(expected_amount, 0)
                    ELSE NULL
                END AS difference_amount,
                status,
                manager,
                memo
            FROM executive_settlement_schedule
            WHERE company_id = ?
              AND settlement_due_date BETWEEN ? AND ?
            """);
        List<Object> params = new ArrayList<>();
        params.add(companyId);
        params.add(sDate);
        params.add(eDate);
        if (channel != null && !channel.isBlank()) {
            sql.append(" AND LOWER(channel_name) = LOWER(?) ");
            params.add(channel);
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND status = ? ");
            params.add(status);
        }
        sql.append(" ORDER BY settlement_due_date ASC");
        try {
            return jdbc.queryForList(sql.toString(), params.toArray());
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * 정산 요약 카드 데이터 계산
     */
    public Map<String, Object> getSettlementSummary(Long companyId, LocalDate startDate, LocalDate endDate) {
        LocalDate today = LocalDate.now();
        LocalDate weekEnd = today.plusDays(7);
        String monthPrefix = today.toString().substring(0, 7);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("todayExpectedDeposit", 0L);
        summary.put("weeklyExpectedDeposit", 0L);
        summary.put("monthlyExpectedDeposit", 0L);
        summary.put("delayedSettlementRisk", 0L);
        summary.put("totalExpectedSettlement", 0L);
        summary.put("completedDepositAmount", 0L);
        summary.put("settlementCount", 0L);

        try {
            Long todayAmt = jdbc.queryForObject(
                "SELECT COALESCE(SUM(expected_amount),0) FROM executive_settlement_schedule WHERE company_id=? AND settlement_due_date=? AND status='PENDING'",
                Long.class, companyId, today);
            summary.put("todayExpectedDeposit", todayAmt);

            Long weekAmt = jdbc.queryForObject(
                "SELECT COALESCE(SUM(expected_amount),0) FROM executive_settlement_schedule WHERE company_id=? AND settlement_due_date BETWEEN ? AND ? AND status='PENDING'",
                Long.class, companyId, today, weekEnd);
            summary.put("weeklyExpectedDeposit", weekAmt);

            Long monthAmt = jdbc.queryForObject(
                "SELECT COALESCE(SUM(expected_amount),0) FROM executive_settlement_schedule WHERE company_id=? AND TO_CHAR(settlement_due_date,'YYYY-MM')=? AND status='PENDING'",
                Long.class, companyId, monthPrefix);
            summary.put("monthlyExpectedDeposit", monthAmt);

            Long overdueAmt = jdbc.queryForObject(
                "SELECT COALESCE(SUM(expected_amount),0) FROM executive_settlement_schedule WHERE company_id=? AND status='OVERDUE'",
                Long.class, companyId);
            summary.put("delayedSettlementRisk", overdueAmt);

            Long totalAmt = jdbc.queryForObject(
                "SELECT COALESCE(SUM(expected_amount),0) FROM executive_settlement_schedule WHERE company_id=? AND status<>'DONE'",
                Long.class, companyId);
            summary.put("totalExpectedSettlement", totalAmt);

            Long doneAmt = jdbc.queryForObject(
                "SELECT COALESCE(SUM(actual_amount),0) FROM executive_settlement_schedule WHERE company_id=? AND status='DONE'",
                Long.class, companyId);
            summary.put("completedDepositAmount", doneAmt);

            Long count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM executive_settlement_schedule WHERE company_id=?",
                Long.class, companyId);
            summary.put("settlementCount", count);

        } catch (Exception e) {
            // 테이블 없거나 오류시 기본값 반환
        }
        return summary;
    }

    /**
     * 날짜별 입금 예정 캘린더
     */
    public List<Map<String, Object>> getDepositCalendar(Long companyId, LocalDate startDate,
            LocalDate endDate, String channel) {
        LocalDate sDate = startDate != null ? startDate : LocalDate.now().withDayOfMonth(1);
        LocalDate eDate = endDate != null ? endDate : LocalDate.now().plusMonths(1);

        StringBuilder sql = new StringBuilder("""
            SELECT
                settlement_due_date AS date,
                COALESCE(channel_name, '기타') AS channel,
                SUM(CASE WHEN status <> 'DONE' THEN COALESCE(expected_amount,0) ELSE 0 END) AS expected_deposit_amount,
                SUM(CASE WHEN status = 'DONE' THEN COALESCE(actual_amount,0) ELSE 0 END)    AS completed_deposit_amount,
                SUM(CASE WHEN status = 'OVERDUE' THEN COALESCE(expected_amount,0) ELSE 0 END) AS delayed_amount,
                MAX(status) AS status
            FROM executive_settlement_schedule
            WHERE company_id = ?
              AND settlement_due_date BETWEEN ? AND ?
            """);
        List<Object> params = new ArrayList<>();
        params.add(companyId);
        params.add(sDate);
        params.add(eDate);
        if (channel != null && !channel.isBlank()) {
            sql.append(" AND LOWER(channel_name) = LOWER(?) ");
            params.add(channel);
        }
        sql.append(" GROUP BY settlement_due_date, channel_name ORDER BY settlement_due_date ASC");
        try {
            return jdbc.queryForList(sql.toString(), params.toArray());
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * 채널별 API 연동 상태 조회
     * channel_api_credentials 테이블 실제 컬럼: channel_type, credential_key1~4, is_active, last_sync_at, last_sync_status
     */
    public List<Map<String, Object>> getChannelIntegrationStatus(Long companyId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT channel_type AS channel_name, is_active, " +
                "(credential_key1 IS NOT NULL AND credential_key1 <> '') AS has_credentials, " +
                "last_sync_at AS updated_at, last_sync_status " +
                "FROM channel_api_credentials ORDER BY channel_type");
            for (Map<String, Object> row : rows) {
                Boolean hasCredentials = (Boolean) row.get("has_credentials");
                Boolean isActive = (Boolean) row.get("is_active");
                row.put("status", (hasCredentials != null && hasCredentials && isActive != null && isActive) ? "연동됨" : "연동 필요");
            }
            return rows;
        } catch (Exception e) {
            List<Map<String, Object>> defaults = new ArrayList<>();
            for (String ch : new String[]{"스마트스토어", "쿠팡", "카카오", "자사몰", "오프라인"}) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("channel_name", ch);
                m.put("is_active", false);
                m.put("has_credentials", false);
                m.put("status", "연동 필요");
                defaults.add(m);
            }
            return defaults;
        }
    }
}
