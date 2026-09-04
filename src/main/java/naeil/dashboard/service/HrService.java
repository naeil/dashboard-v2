package naeil.dashboard.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인사(HR) — 직원 명부·인사카드 + 휴가·연차.
 * 인사담당자(HR_MANAGER)와 대표(EXECUTIVE)가 관리한다.
 */
@Service
@RequiredArgsConstructor
public class HrService {

    private static final String ROSTER_COLS = """
            id, username, display_name, department, position_name, role, status, email, phone,
            hire_date, birth_date, address, emergency_contact, employment_type, base_salary,
            bank_name, bank_account, annual_leave_total, hr_memo, resident_number
            """;

    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;

    private void requireHr(AuthUser actor) {
        UserRole role = UserRole.from(actor.role());
        if (role != UserRole.EXECUTIVE && role != UserRole.HR_MANAGER) {
            throw new CustomException(403, "인사담당자 또는 대표만 접근할 수 있습니다.");
        }
    }

    private static boolean isHrOrExec(AuthUser actor) {
        UserRole role = UserRole.from(actor.role());
        return role == UserRole.EXECUTIVE || role == UserRole.HR_MANAGER;
    }

    /* ── 직원 명부 ── */
    public List<Map<String, Object>> roster(Long companyId, AuthUser actor) {
        requireHr(actor);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT " + ROSTER_COLS + " FROM dashboard_user WHERE company_id = ? AND status <> 'LEFT' "
                        + "ORDER BY status, department, display_name", companyId);
        rows.forEach(HrService::maskResident);
        return rows;
    }

    public Map<String, Object> card(Long companyId, Long id, AuthUser actor) {
        requireHr(actor);
        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT " + ROSTER_COLS + " FROM dashboard_user WHERE id = ? AND company_id = ?", id, companyId);
        maskResident(row);
        // 연차 잔여
        Object username = row.get("username");
        row.put("leaveUsed", leaveUsed(companyId, String.valueOf(username)));
        return row;
    }

    @Transactional
    public Map<String, Object> updateCard(Long companyId, Long id, Map<String, Object> p, AuthUser actor) {
        requireHr(actor);
        StringBuilder sql = new StringBuilder("UPDATE dashboard_user SET updated_at = NOW()");
        java.util.List<Object> params = new java.util.ArrayList<>();
        putStr(p, "positionName", "position_name", sql, params);
        putStr(p, "email", "email", sql, params);
        putStr(p, "phone", "phone", sql, params);
        putStr(p, "address", "address", sql, params);
        putStr(p, "emergencyContact", "emergency_contact", sql, params);
        putStr(p, "employmentType", "employment_type", sql, params);
        putStr(p, "bankName", "bank_name", sql, params);
        putStr(p, "bankAccount", "bank_account", sql, params);
        putStr(p, "hrMemo", "hr_memo", sql, params);
        putDate(p, "hireDate", "hire_date", sql, params);
        putDate(p, "birthDate", "birth_date", sql, params);
        putNum(p, "baseSalary", "base_salary", sql, params);
        putDec(p, "annualLeaveTotal", "annual_leave_total", sql, params);
        // 주민번호는 새 값이 마스킹(*)이 아닐 때만 갱신
        if (p.containsKey("residentNumber")) {
            String rn = str(p.get("residentNumber"));
            if (rn != null && !rn.contains("*")) { sql.append(", resident_number = ?"); params.add(rn); }
        }
        if (params.isEmpty()) return Map.of("success", false, "message", "변경할 값이 없습니다.");
        sql.append(" WHERE id = ? AND company_id = ?");
        params.add(id);
        params.add(companyId);
        int updated = jdbcTemplate.update(sql.toString(), params.toArray());
        return updated > 0 ? Map.of("success", true) : Map.of("success", false, "message", "대상을 찾지 못했습니다.");
    }

    /* ── 휴가·연차 ── */
    public Map<String, Object> myLeaveOverview(Long companyId, AuthUser user) {
        BigDecimal total = jdbcTemplate.query(
                "SELECT annual_leave_total FROM dashboard_user WHERE company_id = ? AND LOWER(username) = LOWER(?)",
                rs -> rs.next() ? rs.getBigDecimal(1) : BigDecimal.valueOf(15), companyId, user.username());
        BigDecimal used = leaveUsed(companyId, user.username());
        List<Map<String, Object>> mine = jdbcTemplate.queryForList("""
                SELECT * FROM leave_request WHERE company_id = ? AND LOWER(username) = LOWER(?)
                ORDER BY id DESC
                """, companyId, user.username());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("annualTotal", total);
        out.put("annualUsed", used);
        out.put("annualRemain", total.subtract(used));
        out.put("requests", mine);
        return out;
    }

    @Transactional
    public Map<String, Object> submitLeave(Long companyId, AuthUser user, Map<String, Object> p) {
        String type = strOr(p.get("leaveType"), "연차");
        LocalDate start = parseDate(p.get("startDate"), null);
        LocalDate end = parseDate(p.get("endDate"), start);
        if (start == null || end == null || end.isBefore(start)) {
            return Map.of("success", false, "message", "휴가 기간이 올바르지 않습니다.");
        }
        BigDecimal days = dec(p.get("days"));
        if (days.signum() <= 0) days = BigDecimal.valueOf(end.toEpochDay() - start.toEpochDay() + 1);
        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO leave_request
                (company_id, username, display_name, department, leave_type, start_date, end_date, days, reason, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED') RETURNING id
                """, Long.class, companyId, user.username(), user.displayName(), user.department(),
                type, java.sql.Date.valueOf(start), java.sql.Date.valueOf(end), days, str(p.get("reason")));
        // 인사담당자·대표에게 알림
        for (String recipient : hrApprovers(companyId)) {
            notificationService.notify(companyId, recipient, "LEAVE_REQUEST",
                    "휴가 신청 · " + user.displayName(),
                    String.format("%s님이 %s %s~%s(%s일) 휴가를 신청했습니다.", user.displayName(), type,
                            start, end, days.stripTrailingZeros().toPlainString()),
                    "hr-leave", id);
        }
        return Map.of("success", true, "id", id);
    }

    public List<Map<String, Object>> leaveInbox(Long companyId, AuthUser actor) {
        requireHr(actor);
        return jdbcTemplate.queryForList("""
                SELECT * FROM leave_request WHERE company_id = ? AND status = 'SUBMITTED'
                ORDER BY start_date, id
                """, companyId);
    }

    public List<Map<String, Object>> leaveAll(Long companyId, AuthUser actor) {
        requireHr(actor);
        return jdbcTemplate.queryForList("""
                SELECT * FROM leave_request WHERE company_id = ?
                ORDER BY id DESC LIMIT 200
                """, companyId);
    }

    @Transactional
    public Map<String, Object> actLeave(Long companyId, Long id, AuthUser actor, String action, String comment) {
        requireHr(actor);
        Map<String, Object> req;
        try {
            req = jdbcTemplate.queryForMap("SELECT * FROM leave_request WHERE id = ? AND company_id = ?", id, companyId);
        } catch (Exception e) { return Map.of("success", false, "message", "신청을 찾을 수 없습니다."); }
        if (!"SUBMITTED".equals(String.valueOf(req.get("status")))) {
            return Map.of("success", false, "message", "이미 처리된 신청입니다.");
        }
        boolean approve = "APPROVE".equalsIgnoreCase(action);
        jdbcTemplate.update("""
                UPDATE leave_request SET status = ?, approver_username = ?, approver_name = ?, review_comment = ?, updated_at = NOW()
                WHERE id = ?
                """, approve ? "APPROVED" : "REJECTED", actor.username(), actor.displayName(), str(comment), id);
        String requester = String.valueOf(req.get("username"));
        String type = String.valueOf(req.get("leave_type"));
        notificationService.notify(companyId, requester, approve ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
                (approve ? "휴가 승인 · " : "휴가 반려 · ") + type,
                approve ? "신청한 휴가가 승인되었습니다." : ("휴가가 반려되었습니다." + (comment == null || comment.isBlank() ? "" : " 사유: " + comment.trim())),
                "hr-leave", id);
        return Map.of("success", true, "message", approve ? "승인했습니다." : "반려했습니다.");
    }

    /* ── 유틸 ── */
    private BigDecimal leaveUsed(Long companyId, String username) {
        BigDecimal used = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(days), 0) FROM leave_request
                WHERE company_id = ? AND LOWER(username) = LOWER(?) AND status = 'APPROVED' AND leave_type IN ('연차', '반차')
                """, BigDecimal.class, companyId, username);
        return used == null ? BigDecimal.ZERO : used;
    }

    private List<String> hrApprovers(Long companyId) {
        return jdbcTemplate.query(
                "SELECT username FROM dashboard_user WHERE company_id = ? AND status = 'ACTIVE' AND role IN ('HR_MANAGER', 'EXECUTIVE')",
                (rs, i) -> rs.getString(1), companyId);
    }

    private static void maskResident(Map<String, Object> row) {
        Object rn = row.get("resident_number");
        if (rn != null) {
            String s = String.valueOf(rn);
            if (s.length() > 7) {
                row.put("resident_number", s.substring(0, 8) + "******");
            }
        }
    }

    private static void putStr(Map<String, Object> p, String key, String col, StringBuilder sql, List<Object> params) {
        if (p.containsKey(key)) { sql.append(", ").append(col).append(" = ?"); params.add(str(p.get(key))); }
    }
    private static void putNum(Map<String, Object> p, String key, String col, StringBuilder sql, List<Object> params) {
        if (p.containsKey(key)) { sql.append(", ").append(col).append(" = ?"); params.add(longOrNull(p.get(key))); }
    }
    private static void putDec(Map<String, Object> p, String key, String col, StringBuilder sql, List<Object> params) {
        if (p.containsKey(key)) { sql.append(", ").append(col).append(" = ?"); params.add(dec(p.get(key))); }
    }
    private static void putDate(Map<String, Object> p, String key, String col, StringBuilder sql, List<Object> params) {
        if (p.containsKey(key)) {
            LocalDate d = parseDate(p.get(key), null);
            sql.append(", ").append(col).append(" = ?");
            params.add(d == null ? null : java.sql.Date.valueOf(d));
        }
    }
    private static String str(Object v) { if (v == null) return null; String s = String.valueOf(v).trim(); return s.isEmpty() ? null : s; }
    private static String strOr(Object v, String d) { String s = str(v); return s == null ? d : s; }
    private static Long longOrNull(Object v) {
        if (v == null) return null;
        try { return new BigDecimal(String.valueOf(v).replace(",", "").trim()).longValue(); } catch (Exception e) { return null; }
    }
    private static BigDecimal dec(Object v) {
        if (v == null) return BigDecimal.ZERO;
        try { return new BigDecimal(String.valueOf(v).replace(",", "").trim()); } catch (Exception e) { return BigDecimal.ZERO; }
    }
    private static LocalDate parseDate(Object v, LocalDate d) {
        if (v == null) return d;
        try { return LocalDate.parse(String.valueOf(v).substring(0, 10)); } catch (Exception e) { return d; }
    }
}
