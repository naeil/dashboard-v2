package naeil.dashboard.service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AI 업무 지시 — 회사 PC 에이전트가 일일 업무 보고를 읽고 업무를 등록한다.
 * 업무는 executive_work_task(source_type = AI_AGENT)에, 지시 내용은 해당 보고서의
 * work_report_feedback(feedback_type = AI_DIRECTIVE)에 남긴다.
 * 인사 민감정보(급여·주민번호·계좌)는 절대 내보내지 않는다.
 */
@Service
@RequiredArgsConstructor
public class AgentWorkService {

    public static final String SOURCE_TYPE = "AI_AGENT";
    private static final String AGENT_USERNAME = "ai-agent";
    private static final String AGENT_DISPLAY_NAME = "AI 에이전트";
    private static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH", "URGENT");

    private final JdbcTemplate jdbcTemplate;

    /** 지시안 작성에 필요한 하루치 맥락: 직원 · 그날 일일 보고 · 미완료 업무 · 보고 누락자. */
    public Map<String, Object> workContext(Long companyId, LocalDate date) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("date", date.toString());
        result.put("staff", jdbcTemplate.queryForList("""
                SELECT username, display_name, department, position_name, role, employment_type
                FROM dashboard_user
                WHERE company_id = ? AND account_scope = 'TENANT' AND status = 'ACTIVE'
                ORDER BY department, display_name
                """, companyId));
        result.put("reports", jdbcTemplate.queryForList("""
                SELECT id, username, display_name, title, completed_work, planned_work, blockers, memo,
                       linked_task_id, linked_project_name, status, updated_at
                FROM staff_work_report
                WHERE company_id = ? AND report_type = 'DAILY' AND report_date = ?
                ORDER BY display_name
                """, companyId, date));
        result.put("openTasks", jdbcTemplate.queryForList("""
                SELECT id, project_name, task_name, assignee_name, department, priority, status,
                       progress_rate, due_date, blocker_text, next_action, source_type
                FROM executive_work_task
                WHERE company_id = ? AND completed_date IS NULL AND status NOT IN ('DONE', 'COMPLETED', 'CANCELLED')
                ORDER BY due_date NULLS LAST, priority
                LIMIT 200
                """, companyId));
        result.put("missingReports", jdbcTemplate.queryForList("""
                SELECT u.username, u.display_name, u.department, u.employment_type
                FROM dashboard_user u
                WHERE u.company_id = ? AND u.account_scope = 'TENANT' AND u.status = 'ACTIVE'
                  AND NOT EXISTS (
                      SELECT 1 FROM staff_work_report r
                      WHERE r.company_id = u.company_id AND LOWER(r.username) = LOWER(u.username)
                        AND r.report_type = 'DAILY' AND r.report_date = ?)
                ORDER BY u.display_name
                """, companyId, date));
        return result;
    }

    /**
     * 업무 지시 1건 등록. sourceKey가 같으면 다시 등록하지 않는다(중복 방지).
     * body: assigneeName*, taskName*, sourceKey*, projectName, priority, dueDate(yyyy-MM-dd),
     *       content(지시 내용), reportId(지시를 댓글로 남길 일일 보고), createTask(기본 true)
     */
    @Transactional
    public Map<String, Object> createDirective(Long companyId, Map<String, Object> body) {
        String assignee = required(body, "assigneeName", 80);
        String taskName = required(body, "taskName", 220);
        String sourceKey = required(body, "sourceKey", 160);
        String projectName = defaultIfBlank(text(body.get("projectName")), "AI 업무 지시", 160);
        String priority = defaultIfBlank(text(body.get("priority")), "MEDIUM", 20).toUpperCase();
        if (!PRIORITIES.contains(priority)) throw new CustomException(400, "priority 값이 올바르지 않습니다.");
        LocalDate dueDate = parseDate(text(body.get("dueDate")));
        String content = text(body.get("content"));
        Long reportId = body.get("reportId") == null ? null : Long.valueOf(String.valueOf(body.get("reportId")));
        boolean createTask = !Boolean.FALSE.equals(body.get("createTask"));

        Integer existing = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM executive_work_task
                WHERE company_id = ? AND source_type = ? AND source_key = ?
                """, Integer.class, companyId, SOURCE_TYPE, sourceKey);
        if (existing != null && existing > 0) {
            return Map.of("created", false, "reason", "이미 등록된 지시입니다.");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("created", true);
        if (createTask) {
            Long taskId = insertTask(companyId, SOURCE_TYPE, sourceKey, projectName, taskName, assignee,
                    priority, dueDate, content);
            result.put("taskId", taskId);
        }
        if (reportId != null && content != null && !content.isBlank()) {
            Integer reportExists = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM staff_work_report WHERE id = ? AND company_id = ?",
                    Integer.class, reportId, companyId);
            if (reportExists == null || reportExists == 0) throw new CustomException(404, "일일 보고를 찾을 수 없습니다.");
            Long feedbackId = jdbcTemplate.queryForObject("""
                    INSERT INTO work_report_feedback
                        (report_id, company_id, author_username, author_display_name, content,
                         feedback_type, assignee_name, due_date, status)
                    VALUES (?, ?, ?, ?, ?, 'AI_DIRECTIVE', ?, ?, 'PENDING')
                    RETURNING id
                    """, Long.class, reportId, companyId, AGENT_USERNAME, AGENT_DISPLAY_NAME, content,
                    assignee, dueDate == null ? null : java.sql.Date.valueOf(dueDate));
            result.put("feedbackId", feedbackId);
        }
        return result;
    }

    /**
     * 담당자 업무(executive_work_task) 1건 생성 — AI 업무 지시와 상담·미팅 기록 후속 업무가 함께 쓴다.
     * 길이 제한(project 160 / task 220 / assignee 80)은 호출하는 쪽에서 맞춘다.
     */
    public Long insertTask(Long companyId, String sourceType, String sourceKey, String projectName, String taskName,
                           String assignee, String priority, LocalDate dueDate, String nextAction) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO executive_work_task
                    (company_id, project_name, task_name, assignee_name, priority, status, progress_rate,
                     start_date, due_date, next_action, source_type, source_key, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'WAITING', 0, CURRENT_DATE, ?, ?, ?, ?, NOW(), NOW())
                RETURNING id
                """, Long.class, companyId, projectName, taskName, assignee, priority,
                dueDate == null ? null : java.sql.Date.valueOf(dueDate), nextAction, sourceType, sourceKey);
    }

    private static String required(Map<String, Object> body, String key, int max) {
        String value = text(body.get(key));
        if (value == null || value.isBlank()) throw new CustomException(400, key + " 값이 필요합니다.");
        value = value.trim();
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String defaultIfBlank(String value, String fallback, int max) {
        String s = value == null || value.isBlank() ? fallback : value.trim();
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value.trim());
        } catch (Exception e) {
            throw new CustomException(400, "dueDate 형식은 yyyy-MM-dd 입니다.");
        }
    }

    private static String text(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
