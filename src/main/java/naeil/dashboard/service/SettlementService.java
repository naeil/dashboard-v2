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
     */
    public List<Map<String, Object>> getRealtimeSales(Long companyId, String channel,
            LocalDate startDate, LocalDate endDate) {
        LocalDate sDate = startDate != null ? startDate : LocalDate.now().minusDays(30);
        LocalDate eDate = endDate != null ? endDate : LocalDate.now();

        StringBuilder sql = new StringBuilder("""
            SELECT
                ocp.shop_name                       AS channel,
                ocp.ord_date                        AS order_date,
                ocp.ord_date                        AS payment_date,
                NULL::date                          AS delivery_completed_date,
                NULL::date                          AS purchase_confirmed_date,
                COUNT(*)                            AS order_count,
                COALESCE(SUM(ocp.qty), 0)           AS sales_quantity,
                COALESCE(SUM(ocp.pay_amt), 0)       AS gross_revenue,
                0                                   AS cancel_amount,
                0                                   AS return_amount,
                COALESCE(SUM(ocp.discount_price), 0) AS discount_amount,
                0                                   AS shipping_fee,
                0                                   AS platform_fee,
                0                                   AS ad_cost,
                COALESCE(SUM(ocp.pay_amt), 0)       AS settlement_base_amount,
                COALESCE(SUM(ocp.pay_amt), 0)       AS expected_settlement_amount,
                NULL                                AS expected_deposit_date,
                'PENDING'                           AS settlement_status
            FROM online_channel_performance ocp
            WHERE ocp.company_id = ?
              AND ocp.ord_date BETWEEN ? AND ?
        """);
        List<Object> params = new ArrayList<>();
        params.add(companyId);
        params.add(sDate);
        params.add(eDate);
        if (channel != null && !channel.isBlank()) {
            sql.append("  AND LOWER(ocp.shop_name) LIKE LOWER(?) ");
            params.add("%" + channel + "%");
        }
        sql.append(" GROUP BY ocp.shop_name, ocp.ord_date ORDER BY ocp.ord_date DESC LIMIT 200");
        return jdbc.queryForList(sql.toString(), params.toArray());
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
                partner_name     AS vendor_name,
                settlement_type  AS type,
                channel_name     AS channel,
                brand_name,
                sale_date        AS sales_date,
                settlement_due_date AS expected_settlement_date,
                expected_amount  AS expected_deposit_amount,
                actual_amount    AS actual_deposit_amount,
                CASE
                    WHEN actual_amount IS NOT NULL
                    THEN actual_amount - COALESCE(expected_amount, 0)
                    ELSE NULL
                END              AS difference_amount,
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
            sql.append("  AND LOWER(channel_name) = LOWER(?) ");
            params.add(channel);
        }
        if (status != null && !status.isBlank()) {
            sql.append("  AND status = ? ");
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
            // 오늘 입금 예정
            Long todayAmt = jdbc.queryForObject(
                "SELECT COALESCE(SUM(expected_amount),0) FROM executive_settlement_schedule WHERE company_id=? AND settlement_due_date=? AND status='PENDING'",
                Long.class, companyId, today);
            summary.put("todayExpectedDeposit", todayAmt);

            // 이번 주
            Long weekAmt = jdbc.queryForObject(
                "SELECT COALESCE(SUM(expected_amount),0) FROM executive_settlement_schedule WHERE company_id=? AND settlement_due_date BETWEEN ? AND ? AND status='PENDING'",
                Long.class, companyId, today, weekEnd);
            summary.put("weeklyExpectedDeposit", weekAmt);

            // 이번 달
            Long monthAmt = jdbc.queryForObject(
                "SELECT COALESCE(SUM(expected_amount),0) FROM executive_settlement_schedule WHERE company_id=? AND TO_CHAR(settlement_due_date,'YYYY-MM')=? AND status='PENDING'",
                Long.class, companyId, monthPrefix);
            summary.put("monthlyExpectedDeposit", monthAmt);

            // 지연 리스크
            Long overdueAmt = jdbc.queryForObject(
                "SELECT COALESCE(SUM(expected_amount),0) FROM executive_settlement_schedule WHERE company_id=? AND status='OVERDUE'",
                Long.class, companyId);
            summary.put("delayedSettlementRisk", overdueAmt);

            // 총 예정
            Long totalAmt = jdbc.queryForObject(
                "SELECT COALESCE(SUM(expected_amount),0) FROM executive_settlement_schedule WHERE company_id=? AND status<>'DONE'",
                Long.class, companyId);
            summary.put("totalExpectedSettlement", totalAmt);

            // 입금 완료
            Long doneAmt = jdbc.queryForObject(
                "SELECT COALESCE(SUM(actual_amount),0) FROM executive_settlement_schedule WHERE company_id=? AND status='DONE'",
                Long.class, companyId);
            summary.put("completedDepositAmount", doneAmt);

            // 건수
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
                settlement_due_date          AS date,
                COALESCE(channel_name, '기타') AS channel,
                SUM(CASE WHEN status <> 'DONE' THEN COALESCE(expected_amount,0) ELSE 0 END) AS expected_deposit_amount,
                SUM(CASE WHEN status = 'DONE' THEN COALESCE(actual_amount,0) ELSE 0 END)    AS completed_deposit_amount,
                SUM(CASE WHEN status = 'OVERDUE' THEN COALESCE(expected_amount,0) ELSE 0 END) AS delayed_amount,
                MAX(status)                  AS status
            FROM executive_settlement_schedule
            WHERE company_id = ?
              AND settlement_due_date BETWEEN ? AND ?
        """);
        List<Object> params = new ArrayList<>();
        params.add(companyId);
        params.add(sDate);
        params.add(eDate);
        if (channel != null && !channel.isBlank()) {
            sql.append("  AND LOWER(channel_name) = LOWER(?) ");
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
     */
    public List<Map<String, Object>> getChannelIntegrationStatus(Long companyId) {
        try {
            return jdbc.queryForList(
                "SELECT channel_name, is_active, access_key IS NOT NULL AS has_credentials, updated_at FROM channel_api_credentials WHERE company_id=? ORDER BY channel_name",
                companyId);
        } catch (Exception e) {
            // channel_api_credentials 테이블이 없거나 컬럼 다를 경우 기본값
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
