package naeil.dashboard.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 지출결의 전자결재 — 기안자 → 1차 승인자 → 2차 최종 승인자.
 * 금액별 전결: 전결 기준 이하는 1차 승인자 전결(1단계), 초과는 2차까지(2단계).
 * 최종 승인되면 현금흐름(지출)에 자동 반영되어 [자금 현황]에 나타난다.
 */
@Service
@RequiredArgsConstructor
public class PaymentApprovalService {

    /** 전결 기준 금액 — 이하 1차 전결, 초과 2차 필수. (필요 시 이 값만 조정) */
    private static final BigDecimal DELEGATION_THRESHOLD = new BigDecimal("300000");

    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;

    /* ── 승인자 후보 (팀장·대표 활성 계정) ── */
    public List<Map<String, Object>> approvers(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT username, display_name, department, role
                FROM dashboard_user
                WHERE company_id = ? AND status = 'ACTIVE' AND role IN ('MANAGER', 'EXECUTIVE')
                ORDER BY CASE role WHEN 'EXECUTIVE' THEN 0 ELSE 1 END, display_name
                """, companyId);
    }

    /* ── 협조/참조 후보 (전체 활성 구성원) ── */
    public List<Map<String, Object>> members(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT username, display_name, department, role
                FROM dashboard_user
                WHERE company_id = ? AND status = 'ACTIVE'
                ORDER BY department, display_name
                """, companyId);
    }

    /* ── 결의 제출 (기안) ── */
    @Transactional
    public Map<String, Object> submit(Long companyId, AuthUser user, Map<String, Object> p) {
        String title = str(p.get("title"));
        String counterparty = str(p.get("counterparty"));
        BigDecimal amount = dec(p.get("amount"));
        if (title == null) return fail("제목을 입력하세요.");
        if (amount.signum() <= 0) return fail("금액을 입력하세요.");
        String approver1 = str(p.get("approver1Username"));
        if (approver1 == null) return fail("1차 승인자를 지정하세요.");

        int requiredSteps = amount.compareTo(DELEGATION_THRESHOLD) > 0 ? 2 : 1;
        String approver2 = str(p.get("approver2Username"));
        if (requiredSteps == 2 && approver2 == null) {
            return fail(String.format("%,d원을 초과하는 결의는 2차 최종 승인자를 반드시 지정해야 합니다.",
                    DELEGATION_THRESHOLD.longValue()));
        }
        String approver1Name = nameOf(companyId, approver1);
        String approver2Name = approver2 == null ? null : nameOf(companyId, approver2);

        LocalDate scheduled = parseDate(p.get("scheduledDate"), LocalDate.now());

        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO executive_payment_request
                (company_id, request_type, flow_type, counterparty, requester_name, department,
                 amount, request_date, scheduled_date, purpose, detail_reason, expense_category,
                 title, expense_item1, expense_item2, pay_method, pay_bank, account_holder, account_number,
                 evidence_url, urgent, approver1_username, approver1_name, approver2_username, approver2_name,
                 required_steps, current_step, status)
                VALUES (?, 'EXPENSE_APPROVAL', 'OUTFLOW', ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'SUBMITTED')
                RETURNING id
                """, Long.class,
                companyId, counterparty, user.displayName(), user.department(),
                amount, java.sql.Date.valueOf(LocalDate.now()), java.sql.Date.valueOf(scheduled),
                title, str(p.get("detailReason")), str(p.getOrDefault("expenseCategory", "운영비")),
                title, str(p.get("expenseItem1")), str(p.get("expenseItem2")),
                str(p.getOrDefault("payMethod", "계좌이체")), str(p.get("payBank")),
                str(p.get("accountHolder")), str(p.get("accountNumber")),
                str(p.get("evidenceUrl")), Boolean.TRUE.equals(p.get("urgent")),
                approver1, approver1Name, approver2, approver2Name, requiredSteps);

        // requester_name 저장은 display_name이지만 알림/본인확인은 username 기준이 필요 → account_name에 기안자 username 보관
        jdbcTemplate.update("UPDATE executive_payment_request SET account_name = ? WHERE id = ?",
                user.username(), id);

        // 협조자 / 참조자
        List<String> cooperators = usernameList(p.get("cooperatorUsernames"));
        List<String> referrers = usernameList(p.get("referrerUsernames"));
        if (!cooperators.isEmpty() || !referrers.isEmpty()) {
            jdbcTemplate.update("""
                    UPDATE executive_payment_request
                    SET cooperator_usernames = ?, cooperator_names = ?, referrer_usernames = ?, referrer_names = ?
                    WHERE id = ?
                    """,
                    joinCsv(cooperators), joinCsv(namesOf(companyId, cooperators)),
                    joinCsv(referrers), joinCsv(namesOf(companyId, referrers)), id);
        }

        notificationService.notify(companyId, approver1, "PAYMENT_APPROVAL_REQUEST",
                "결재 요청 · " + title,
                String.format("%s님이 %,d원 지출결의를 올렸습니다. 1차 승인 대기 중입니다.",
                        user.displayName(), amount.longValue()),
                "payment-approval", id);
        for (String c : cooperators) {
            notificationService.notify(companyId, c, "PAYMENT_COOPERATION_REQUEST",
                    "협조 요청 · " + title,
                    String.format("%s님이 올린 %,d원 지출결의에 협조 검토를 요청했습니다.", user.displayName(), amount.longValue()),
                    "payment-approval", id);
        }
        for (String r : referrers) {
            notificationService.notify(companyId, r, "PAYMENT_REFERENCE",
                    "참조 · " + title,
                    String.format("%s님이 올린 %,d원 지출결의에 참조로 지정되었습니다.", user.displayName(), amount.longValue()),
                    "payment-approval", id);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("id", id);
        result.put("requiredSteps", requiredSteps);
        return result;
    }

    /* ── 내 결재함: 지금 내가 승인해야 할 결의 ── */
    public List<Map<String, Object>> inbox(Long companyId, AuthUser user) {
        boolean exec = UserRole.from(user.role()) == UserRole.EXECUTIVE;
        // 1차 대기(SUBMITTED)에서 내가 1차 승인자, 2차 대기(REVIEWING)에서 내가 2차 승인자
        // 대표는 대기 중 어느 것이든 볼 수 있게(전결 개입) — exec 이면 모든 대기.
        String sql = """
                SELECT * FROM executive_payment_request
                WHERE company_id = ?
                  AND status IN ('SUBMITTED', 'REVIEWING')
                """ + (exec ? "" : """
                  AND ( (status = 'SUBMITTED' AND LOWER(approver1_username) = LOWER(?))
                     OR (status = 'REVIEWING' AND LOWER(approver2_username) = LOWER(?)) )
                """) + """
                ORDER BY urgent DESC, scheduled_date, id
                """;
        if (exec) return jdbcTemplate.queryForList(sql, companyId);
        return jdbcTemplate.queryForList(sql, companyId, user.username(), user.username());
    }

    /* ── 협조 요청함: 내가 협조자로 지정된 결의 ── */
    public List<Map<String, Object>> cooperationInbox(Long companyId, AuthUser user) {
        return jdbcTemplate.queryForList("""
                SELECT r.*,
                       EXISTS (SELECT 1 FROM payment_approval_step s
                               WHERE s.request_id = r.id AND s.action = 'COOPERATE'
                                 AND LOWER(s.approver_username) = LOWER(?)) AS cooperated
                FROM executive_payment_request r
                WHERE r.company_id = ?
                  AND ('' || LOWER(COALESCE(r.cooperator_usernames, '')))
                      ~ ('(^|,)' || LOWER(?) || '(,|$)')
                ORDER BY r.id DESC
                """, user.username(), companyId, user.username());
    }

    /* ── 협조 의견 (비차단) ── */
    @Transactional
    public Map<String, Object> cooperate(Long companyId, Long id, AuthUser user, String comment) {
        Map<String, Object> req;
        try {
            req = jdbcTemplate.queryForMap(
                    "SELECT * FROM executive_payment_request WHERE id = ? AND company_id = ?", id, companyId);
        } catch (Exception e) { return fail("결의를 찾을 수 없습니다."); }
        String coops = String.valueOf(req.getOrDefault("cooperator_usernames", ""));
        boolean isCoop = usernameList(coops).stream().anyMatch(u -> u.equalsIgnoreCase(user.username()));
        if (!isCoop) return fail("이 결의의 협조자가 아닙니다.");
        jdbcTemplate.update("""
                INSERT INTO payment_approval_step
                (company_id, request_id, step_no, approver_username, approver_name, action, comment)
                VALUES (?, ?, 0, ?, ?, 'COOPERATE', ?)
                """, companyId, id, user.username(), user.displayName(), str(comment));
        notificationService.notify(companyId, String.valueOf(req.get("account_name")), "PAYMENT_COOPERATED",
                "협조 완료 · " + req.getOrDefault("title", "지출결의"),
                String.format("%s님이 협조 의견을 남겼습니다.%s", user.displayName(),
                        comment == null || comment.isBlank() ? "" : " (" + comment.trim() + ")"),
                "payment-request", id);
        return ok("협조 의견을 등록했습니다.");
    }

    /* ── 내가 올린 결의 ── */
    public List<Map<String, Object>> mine(Long companyId, AuthUser user) {
        return jdbcTemplate.queryForList("""
                SELECT * FROM executive_payment_request
                WHERE company_id = ? AND LOWER(account_name) = LOWER(?)
                ORDER BY id DESC
                """, companyId, user.username());
    }

    /* ── 상세 + 결재 이력 ── */
    public Map<String, Object> detail(Long companyId, Long id) {
        Map<String, Object> req = jdbcTemplate.queryForMap(
                "SELECT * FROM executive_payment_request WHERE id = ? AND company_id = ?", id, companyId);
        List<Map<String, Object>> steps = jdbcTemplate.queryForList(
                "SELECT step_no, approver_name, action, comment, acted_at FROM payment_approval_step WHERE request_id = ? ORDER BY id",
                id);
        req.put("steps", steps);
        return req;
    }

    /* ── 승인 / 반려 ── */
    @Transactional
    public Map<String, Object> act(Long companyId, Long id, AuthUser user, String action, String comment) {
        Map<String, Object> req;
        try {
            req = jdbcTemplate.queryForMap(
                    "SELECT * FROM executive_payment_request WHERE id = ? AND company_id = ?", id, companyId);
        } catch (Exception e) {
            return fail("결의를 찾을 수 없습니다.");
        }
        String status = String.valueOf(req.get("status"));
        boolean exec = UserRole.from(user.role()) == UserRole.EXECUTIVE;
        int requiredSteps = intOf(req.get("required_steps"), 1);
        String requester = String.valueOf(req.get("account_name"));
        String title = String.valueOf(req.getOrDefault("title", "지출결의"));
        BigDecimal amount = dec(req.get("amount"));

        int step;
        if ("SUBMITTED".equals(status)) {
            step = 1;
            if (!exec && !eq(user.username(), req.get("approver1_username"))) {
                return fail("이 결의의 1차 승인자가 아닙니다.");
            }
        } else if ("REVIEWING".equals(status)) {
            step = 2;
            if (!exec && !eq(user.username(), req.get("approver2_username"))) {
                return fail("이 결의의 2차 최종 승인자가 아닙니다.");
            }
        } else {
            return fail("이미 처리된 결의입니다. (현재 상태: " + status + ")");
        }

        boolean reject = "REJECT".equalsIgnoreCase(action);
        jdbcTemplate.update("""
                INSERT INTO payment_approval_step
                (company_id, request_id, step_no, approver_username, approver_name, action, comment)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, companyId, id, step, user.username(), user.displayName(),
                reject ? "REJECT" : "APPROVE", str(comment));

        if (reject) {
            jdbcTemplate.update("UPDATE executive_payment_request SET status = 'REJECTED', current_step = ?, review_comment = ?, updated_at = NOW() WHERE id = ?",
                    step, str(comment), id);
            notificationService.notify(companyId, requester, "PAYMENT_REJECTED",
                    "결재 반려 · " + title,
                    String.format("%s님이 %d차에서 반려했습니다.%s", user.displayName(), step,
                            comment == null || comment.isBlank() ? "" : " 사유: " + comment.trim()),
                    "payment-request", id);
            return ok("반려 처리했습니다.");
        }

        // 승인
        boolean finalStep = step >= requiredSteps;
        if (finalStep) {
            applyToCashFlow(req);
            jdbcTemplate.update("UPDATE executive_payment_request SET status = 'CASH_APPLIED', current_step = ?, updated_at = NOW() WHERE id = ?",
                    step, id);
            notificationService.notify(companyId, requester, "PAYMENT_APPROVED",
                    "결재 승인 완료 · " + title,
                    String.format("%,d원 지출결의가 최종 승인되어 자금 현황에 반영되었습니다.", amount.longValue()),
                    "cash-position", id);
            return ok("최종 승인 완료 — 자금 현황(지출)에 반영되었습니다.");
        } else {
            jdbcTemplate.update("UPDATE executive_payment_request SET status = 'REVIEWING', current_step = ?, updated_at = NOW() WHERE id = ?",
                    step, id);
            String approver2 = String.valueOf(req.get("approver2_username"));
            notificationService.notify(companyId, approver2, "PAYMENT_APPROVAL_REQUEST",
                    "최종 결재 요청 · " + title,
                    String.format("1차 승인 완료. %,d원 지출결의의 2차 최종 승인을 기다립니다.", amount.longValue()),
                    "payment-approval", id);
            return ok("1차 승인 완료 — 2차 최종 승인자에게 넘어갔습니다.");
        }
    }

    /* 최종 승인 시 현금흐름(지출) 생성 → [자금 현황]에 반영 */
    private void applyToCashFlow(Map<String, Object> req) {
        Long id = ((Number) req.get("id")).longValue();
        if (req.get("cash_flow_id") != null) return;
        jdbcTemplate.update("""
                INSERT INTO executive_cash_flow
                (company_id, flow_date, flow_type, category, counterparty, amount,
                 status, confidence_level, recurring_rule, source_type, source_key, memo)
                VALUES (?, ?, 'OUTFLOW', ?, ?, ?, 'SCHEDULED', 'CONFIRMED', 'NONE', 'PAYMENT_REQUEST', ?, ?)
                """,
                req.get("company_id"), req.get("scheduled_date"),
                req.getOrDefault("expense_category", "운영비"), req.get("counterparty"), req.get("amount"),
                String.valueOf(id), "[지출결의 승인] " + req.getOrDefault("title", req.get("purpose")));
        Long cashFlowId = jdbcTemplate.queryForObject("""
                SELECT id FROM executive_cash_flow
                WHERE source_type = 'PAYMENT_REQUEST' AND source_key = ?
                ORDER BY id DESC LIMIT 1
                """, Long.class, String.valueOf(id));
        jdbcTemplate.update("UPDATE executive_payment_request SET cash_flow_id = ? WHERE id = ?", cashFlowId, id);
    }

    /* ── 유틸 ── */
    @SuppressWarnings("unchecked")
    private static List<String> usernameList(Object value) {
        List<String> out = new ArrayList<>();
        if (value == null) return out;
        if (value instanceof List<?> list) {
            for (Object o : list) { String s = str(o); if (s != null && !out.contains(s)) out.add(s); }
        } else {
            for (String part : String.valueOf(value).split(",")) {
                String s = str(part); if (s != null && !out.contains(s)) out.add(s);
            }
        }
        return out;
    }
    private static String joinCsv(List<String> list) {
        return list == null || list.isEmpty() ? null : String.join(",", list);
    }
    private List<String> namesOf(Long companyId, List<String> usernames) {
        List<String> names = new ArrayList<>();
        for (String u : usernames) names.add(nameOf(companyId, u));
        return names;
    }

    private String nameOf(Long companyId, String username) {
        if (username == null) return null;
        List<String> names = jdbcTemplate.query(
                "SELECT display_name FROM dashboard_user WHERE company_id = ? AND LOWER(username) = LOWER(?)",
                (rs, i) -> rs.getString(1), companyId, username);
        return names.isEmpty() ? username : names.get(0);
    }

    private static boolean eq(String a, Object b) {
        return b != null && a != null && a.equalsIgnoreCase(String.valueOf(b));
    }
    private static Map<String, Object> fail(String msg) { return Map.of("success", false, "message", msg); }
    private static Map<String, Object> ok(String msg) { return Map.of("success", true, "message", msg); }
    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }
    private static BigDecimal dec(Object v) {
        if (v == null) return BigDecimal.ZERO;
        try { return new BigDecimal(String.valueOf(v).replace(",", "").trim()); }
        catch (Exception e) { return BigDecimal.ZERO; }
    }
    private static int intOf(Object v, int fallback) {
        try { return Integer.parseInt(String.valueOf(v)); } catch (Exception e) { return fallback; }
    }
    private static LocalDate parseDate(Object v, LocalDate fallback) {
        if (v == null) return fallback;
        try { return LocalDate.parse(String.valueOf(v).substring(0, 10)); } catch (Exception e) { return fallback; }
    }
}
