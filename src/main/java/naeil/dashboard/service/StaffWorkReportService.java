package naeil.dashboard.service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class StaffWorkReportService {

    private final JdbcTemplate jdbcTemplate;

    public List<Map<String, Object>> listReports(Long companyId, AuthUser user, String reportType) {
        String normalizedType = normalizeReportTypeOrNull(reportType);
        if (UserRole.from(user.role()) != UserRole.EXECUTIVE) {
            // 본인 보고 + 관리자가 열람 권한을 부여한 대상(report_view_permission)의 보고
            String visibility = """
                    AND (LOWER(username) = LOWER(?)
                         OR LOWER(username) IN (
                             SELECT LOWER(target_username) FROM report_view_permission
                             WHERE company_id = ? AND LOWER(viewer_username) = LOWER(?)))
                    """;
            if (normalizedType == null) {
                return jdbcTemplate.queryForList("""
                        SELECT *
                        FROM staff_work_report
                        WHERE company_id = ?
                        """ + visibility + """
                        ORDER BY report_date DESC, username, id DESC
                        """, companyId, user.username(), companyId, user.username());
            }
            return jdbcTemplate.queryForList("""
                    SELECT *
                    FROM staff_work_report
                    WHERE company_id = ?
                    """ + visibility + """
                      AND report_type = ?
                    ORDER BY report_date DESC, username, id DESC
                    """, companyId, user.username(), companyId, user.username(), normalizedType);
        }

        if (normalizedType == null) {
            return jdbcTemplate.queryForList("""
                    SELECT *
                    FROM staff_work_report
                    WHERE company_id = ?
                    ORDER BY report_date DESC, username, id DESC
                    """, companyId);
        }
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM staff_work_report
                WHERE company_id = ?
                  AND report_type = ?
                ORDER BY report_date DESC, username, id DESC
                """, companyId, normalizedType);
    }

    public Map<String, Object> createReport(Long companyId, AuthUser user, Map<String, Object> payload) {
        String reportType = normalizeReportType(stringValue(payload.get("report_type"), "DAILY"));
        LocalDate reportDate = toDate(payload.get("report_date"), LocalDate.now());
        LocalDate weekStartDate = toDate(payload.get("week_start_date"), reportDate);
        String title = required(payload.get("title"), "보고 제목을 입력하세요.");

        jdbcTemplate.update("""
                INSERT INTO staff_work_report (
                    company_id, username, display_name, report_type, report_date, week_start_date,
                    title, completed_work, planned_work, blockers, memo, status,
                    linked_task_id, linked_project_name
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                companyId,
                user.username(),
                user.displayName(),
                reportType,
                reportDate,
                weekStartDate,
                title,
                blankToNull(payload.get("completed_work")),
                blankToNull(payload.get("planned_work")),
                blankToNull(payload.get("blockers")),
                blankToNull(payload.get("memo")),
                normalizeStatus(stringValue(payload.get("status"), "SUBMITTED")),
                longOrNull(payload.get("linked_task_id")),
                blankToNull(payload.get("linked_project_name"))
        );

        Long id = jdbcTemplate.queryForObject("""
                SELECT id
                FROM staff_work_report
                WHERE company_id = ? AND LOWER(username) = LOWER(?)
                ORDER BY id DESC
                LIMIT 1
                """, Long.class, companyId, user.username());

        return getReport(id);
    }

    public Map<String, Object> updateReport(Long id, AuthUser user, Map<String, Object> payload) {
        ensureAccess(id, user);
        Map<String, Object> values = new HashMap<>();
        putIfPresent(values, "report_type", normalizeReportTypeOrNull(payload.get("report_type")));
        putIfPresent(values, "report_date", toDateOrNull(payload.get("report_date")));
        putIfPresent(values, "week_start_date", toDateOrNull(payload.get("week_start_date")));
        putIfPresent(values, "title", blankToNull(payload.get("title")));
        putIfPresent(values, "completed_work", blankToNull(payload.get("completed_work")));
        putIfPresent(values, "planned_work", blankToNull(payload.get("planned_work")));
        putIfPresent(values, "blockers", blankToNull(payload.get("blockers")));
        putIfPresent(values, "memo", blankToNull(payload.get("memo")));
        putIfPresent(values, "status", normalizeStatusOrNull(payload.get("status")));
        if (payload.containsKey("linked_task_id")) {
            values.put("linked_task_id", longOrNull(payload.get("linked_task_id")));
        }
        if (payload.containsKey("linked_project_name")) {
            values.put("linked_project_name", blankToNull(payload.get("linked_project_name")));
        }

        if (values.isEmpty()) {
            return getReport(id);
        }

        values.put("updated_at", java.time.OffsetDateTime.now());
        List<String> columns = values.keySet().stream().toList();
        String setSql = String.join(", ", columns.stream().map(column -> column + " = ?").toList());
        List<Object> params = new java.util.ArrayList<>(columns.stream().map(values::get).toList());
        params.add(id);

        jdbcTemplate.update("UPDATE staff_work_report SET " + setSql + " WHERE id = ?", params.toArray());
        return getReport(id);
    }

    public void deleteReport(Long id, AuthUser user) {
        ensureAccess(id, user);
        jdbcTemplate.update("DELETE FROM staff_work_report WHERE id = ?", id);
    }

    private Map<String, Object> getReport(Long id) {
        return jdbcTemplate.queryForMap("SELECT * FROM staff_work_report WHERE id = ?", id);
    }

    private void ensureAccess(Long id, AuthUser user) {
        if (UserRole.from(user.role()) == UserRole.EXECUTIVE) {
            return;
        }
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM staff_work_report
                WHERE id = ? AND LOWER(username) = LOWER(?)
                """, Integer.class, id, user.username());
        if (count == null || count == 0) {
            throw new CustomException(403, "본인 업무 보고만 수정할 수 있습니다.");
        }
    }

    private static void putIfPresent(Map<String, Object> values, String key, Object value) {
        if (value != null) {
            values.put(key, value);
        }
    }

    private static String normalizeReportType(String value) {
        String normalized = stringValue(value, "DAILY").trim().toUpperCase();
        return "WEEKLY".equals(normalized) ? "WEEKLY" : "DAILY";
    }

    private static String normalizeReportTypeOrNull(Object value) {
        return value == null ? null : normalizeReportType(value.toString());
    }

    private static String normalizeStatus(String value) {
        String normalized = stringValue(value, "SUBMITTED").trim().toUpperCase();
        return "DRAFT".equals(normalized) ? "DRAFT" : "SUBMITTED";
    }

    private static String normalizeStatusOrNull(Object value) {
        return value == null ? null : normalizeStatus(value.toString());
    }

    private static LocalDate toDate(Object value, LocalDate fallback) {
        LocalDate parsed = toDateOrNull(value);
        return parsed == null ? fallback : parsed;
    }

    private static LocalDate toDateOrNull(Object value) {
        if (value == null || value.toString().isBlank()) {
            return null;
        }
        return LocalDate.parse(value.toString().substring(0, 10));
    }

    private static String required(Object value, String message) {
        String text = blankToNull(value);
        if (text == null) {
            throw new CustomException(400, message);
        }
        return text;
    }

    private static String stringValue(Object value, String fallback) {
        return value == null ? fallback : value.toString();
    }

    private static String blankToNull(Object value) {
        if (value == null) return null;
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private static Long longOrNull(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        try {
            return Long.valueOf(value.toString());
        } catch (Exception exception) {
            return null;
        }
    }
}
