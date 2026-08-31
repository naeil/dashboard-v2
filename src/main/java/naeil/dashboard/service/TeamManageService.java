package naeil.dashboard.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 팀 관리 — 부서 기준 자동 팀 구성.
 * 팀장(MANAGER)은 자기 부서 실무자들의 보고 제출 현황·업무 부하를 모니터링하고 보고에 피드백을 남긴다.
 * 대표(EXECUTIVE)는 전체 부서를 본다.
 */
@Service
@RequiredArgsConstructor
public class TeamManageService {

    private final JdbcTemplate jdbcTemplate;

    /* ───────── 팀 현황 ───────── */

    public Map<String, Object> getOverview(Long companyId, AuthUser user) {
        UserRole role = UserRole.from(user.role());
        if (role == UserRole.EMPLOYEE) {
            throw new CustomException(403, "팀장 이상만 볼 수 있습니다.");
        }
        String department = null;
        if (role == UserRole.MANAGER) {
            department = jdbcTemplate.query(
                    "SELECT department FROM dashboard_user WHERE company_id = ? AND LOWER(username) = LOWER(?)",
                    rs -> rs.next() ? rs.getString(1) : null, companyId, user.username());
        }

        List<Map<String, Object>> members = department == null
                ? jdbcTemplate.queryForList("""
                    SELECT username, display_name, COALESCE(department, '미지정') AS department, role
                    FROM dashboard_user
                    WHERE company_id = ? AND status = 'ACTIVE' AND role <> 'EXECUTIVE'
                    ORDER BY department, role DESC, display_name
                    """, companyId)
                : jdbcTemplate.queryForList("""
                    SELECT username, display_name, COALESCE(department, '미지정') AS department, role
                    FROM dashboard_user
                    WHERE company_id = ? AND status = 'ACTIVE' AND role <> 'EXECUTIVE'
                      AND COALESCE(department, '미지정') = COALESCE(?, '미지정')
                    ORDER BY role DESC, display_name
                    """, companyId, department);

        LocalDate weekStart = LocalDate.now().with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        // 이번 주 일일보고 제출일 (사용자별)
        Map<String, List<String>> submitted = new HashMap<>();
        jdbcTemplate.query("""
                SELECT LOWER(username) AS u, report_date
                FROM staff_work_report
                WHERE company_id = ? AND report_type = 'DAILY' AND report_date BETWEEN ? AND ?
                """, rs -> {
            submitted.computeIfAbsent(rs.getString("u"), k -> new ArrayList<>())
                    .add(String.valueOf(rs.getDate("report_date").toLocalDate()));
        }, companyId, java.sql.Date.valueOf(weekStart), java.sql.Date.valueOf(weekEnd));

        // 마지막 보고
        Map<String, Map<String, Object>> lastReport = new HashMap<>();
        jdbcTemplate.query("""
                SELECT DISTINCT ON (LOWER(username)) LOWER(username) AS u, report_date, title
                FROM staff_work_report
                WHERE company_id = ? AND report_type = 'DAILY'
                ORDER BY LOWER(username), report_date DESC, id DESC
                """, rs -> {
            Map<String, Object> m = new HashMap<>();
            m.put("date", String.valueOf(rs.getDate("report_date").toLocalDate()));
            m.put("title", rs.getString("title"));
            lastReport.put(rs.getString("u"), m);
        }, companyId);

        // 진행중·지연 업무 (담당자 이름 매칭)
        Map<String, long[]> tasks = new HashMap<>();
        jdbcTemplate.query("""
                SELECT COALESCE(assignee_name, '') AS name,
                       COUNT(*) AS open_cnt,
                       COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE) AS delayed_cnt
                FROM executive_work_task
                WHERE company_id = ? AND status NOT IN ('DONE')
                GROUP BY 1
                """, rs -> {
            tasks.put(rs.getString("name").trim(),
                    new long[]{rs.getLong("open_cnt"), rs.getLong("delayed_cnt")});
        }, companyId);

        List<Map<String, Object>> rows = new ArrayList<>();
        int noReportToday = 0;
        String today = LocalDate.now().toString();
        boolean weekday = LocalDate.now().getDayOfWeek().getValue() <= 5;
        for (Map<String, Object> m : members) {
            String username = String.valueOf(m.get("username")).toLowerCase();
            String displayName = String.valueOf(m.get("display_name"));
            List<String> dates = submitted.getOrDefault(username, List.of());
            long[] task = tasks.getOrDefault(displayName, new long[]{0, 0});
            boolean todaySubmitted = dates.contains(today);
            if (weekday && !todaySubmitted) noReportToday++;
            Map<String, Object> row = new LinkedHashMap<>(m);
            row.put("weekDates", dates);
            row.put("todaySubmitted", todaySubmitted);
            row.put("openTasks", task[0]);
            row.put("delayedTasks", task[1]);
            row.put("lastReport", lastReport.get(username));
            row.put("isSelf", username.equalsIgnoreCase(user.username()));
            rows.add(row);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("weekStart", weekStart.toString());
        result.put("weekEnd", weekEnd.toString());
        result.put("department", department);
        result.put("members", rows);
        result.put("noReportToday", weekday ? noReportToday : 0);
        result.put("membersWithDelay", rows.stream().filter(r -> ((Number) r.get("delayedTasks")).longValue() > 0).count());
        return result;
    }

    /* ───────── 보고 코멘트 (피드백) ───────── */

    public List<Map<String, Object>> listComments(Long companyId, Long reportId) {
        return jdbcTemplate.queryForList("""
                SELECT id, report_id, author_username, author_name, content, created_at
                FROM staff_report_comment
                WHERE company_id = ? AND report_id = ?
                ORDER BY id
                """, companyId, reportId);
    }

    public Map<String, Object> addComment(Long companyId, Long reportId, AuthUser user, String content) {
        if (content == null || content.isBlank()) {
            return Map.of("success", false, "message", "내용을 입력하세요.");
        }
        if (!canComment(companyId, reportId, user)) {
            return Map.of("success", false, "message", "이 보고에 코멘트할 권한이 없습니다.");
        }
        jdbcTemplate.update("""
                INSERT INTO staff_report_comment (company_id, report_id, author_username, author_name, content)
                VALUES (?, ?, ?, ?, ?)
                """, companyId, reportId, user.username(), user.displayName(),
                content.trim().substring(0, Math.min(content.trim().length(), 1000)));
        return Map.of("success", true);
    }

    public Map<String, Object> deleteComment(Long companyId, Long commentId, AuthUser user) {
        int deleted;
        if (UserRole.from(user.role()) == UserRole.EXECUTIVE) {
            deleted = jdbcTemplate.update(
                    "DELETE FROM staff_report_comment WHERE id = ? AND company_id = ?", commentId, companyId);
        } else {
            deleted = jdbcTemplate.update(
                    "DELETE FROM staff_report_comment WHERE id = ? AND company_id = ? AND LOWER(author_username) = LOWER(?)",
                    commentId, companyId, user.username());
        }
        return deleted > 0 ? Map.of("success", true)
                : Map.of("success", false, "message", "본인이 쓴 코멘트만 삭제할 수 있습니다.");
    }

    /**
     * 코멘트 권한: 대표 전부 / 팀장은 같은 부서 보고 / 보고 작성자 본인(답글).
     */
    private boolean canComment(Long companyId, Long reportId, AuthUser user) {
        UserRole role = UserRole.from(user.role());
        if (role == UserRole.EXECUTIVE) return true;
        Map<String, Object> owner;
        try {
            owner = jdbcTemplate.queryForMap(
                    "SELECT username FROM staff_work_report WHERE id = ? AND company_id = ?", reportId, companyId);
        } catch (Exception e) {
            return false;
        }
        String ownerUsername = String.valueOf(owner.get("username"));
        if (ownerUsername.equalsIgnoreCase(user.username())) return true;
        if (role != UserRole.MANAGER) return false;
        Integer sameDept = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM dashboard_user me, dashboard_user target
                WHERE me.company_id = ? AND target.company_id = ?
                  AND LOWER(me.username) = LOWER(?) AND LOWER(target.username) = LOWER(?)
                  AND COALESCE(me.department, '미지정') = COALESCE(target.department, '미지정')
                """, Integer.class, companyId, companyId, user.username(), ownerUsername);
        return sameDept != null && sameDept > 0;
    }
}
