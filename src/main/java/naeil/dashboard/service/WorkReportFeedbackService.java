package naeil.dashboard.service;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WorkReportFeedbackService {

    private final JdbcTemplate jdbcTemplate;

    public List<Map<String, Object>> listFeedbacks(Long reportId) {
        return jdbcTemplate.queryForList(
            "SELECT f.*, COALESCE(f.author_display_name, f.author_username) AS author_label " +
            "FROM work_report_feedback f WHERE f.report_id = ? ORDER BY f.created_at ASC",
            reportId);
    }

    public Map<String, Object> createFeedback(Long reportId, AuthUser user, Map<String, Object> payload) {
        String content = blankToNull(payload.get("content"));
        if (content == null) throw new CustomException(400, "피드백 내용을 입력하세요.");
        String feedbackType = blankToNull(payload.get("feedbackType"));
        if (feedbackType == null) feedbackType = "CHECK_REQUEST";
        String assigneeName = blankToNull(payload.get("assigneeName"));
        String dueDateStr = blankToNull(payload.get("dueDate"));
        String status = blankToNull(payload.get("status"));
        if (status == null) status = "PENDING";
        String mentionedUsernames = extractMentions(content);
        jdbcTemplate.update(
            "INSERT INTO work_report_feedback (report_id, company_id, author_username, author_display_name, content, mentioned_usernames, feedback_type, assignee_name, due_date, status) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            reportId, 1L, user.username(), user.displayName(), content, mentionedUsernames,
            feedbackType, assigneeName,
            (dueDateStr != null ? java.sql.Date.valueOf(dueDateStr) : null),
            status);
        Long id = jdbcTemplate.queryForObject(
            "SELECT id FROM work_report_feedback WHERE report_id = ? AND author_username = ? ORDER BY id DESC LIMIT 1",
            Long.class, reportId, user.username());
        return getFeedback(id);
    }

    public Map<String, Object> updateFeedback(Long id, AuthUser user, Map<String, Object> payload) {
        ensureAccess(id, user);
        String content = blankToNull(payload.get("content"));
        if (content == null) throw new CustomException(400, "피드백 내용을 입력하세요.");
        String feedbackType = blankToNull(payload.get("feedbackType"));
        if (feedbackType == null) feedbackType = "CHECK_REQUEST";
        String assigneeName = blankToNull(payload.get("assigneeName"));
        String dueDateStr = blankToNull(payload.get("dueDate"));
        String status = blankToNull(payload.get("status"));
        if (status == null) status = "PENDING";
        String mentionedUsernames = extractMentions(content);
        jdbcTemplate.update(
            "UPDATE work_report_feedback SET content = ?, mentioned_usernames = ?, feedback_type = ?, assignee_name = ?, due_date = ?, status = ?, updated_at = now() WHERE id = ?",
            content, mentionedUsernames, feedbackType, assigneeName,
            (dueDateStr != null ? java.sql.Date.valueOf(dueDateStr) : null),
            status, id);
        return getFeedback(id);
    }

    public Map<String, Object> updateFeedbackStatus(Long id, AuthUser user, String status) {
        if (status == null || status.isBlank()) throw new CustomException(400, "상태값을 입력하세요.");
        String normalizedStatus = status.trim().toUpperCase();
        if (!normalizedStatus.equals("PENDING") && !normalizedStatus.equals("IN_PROGRESS") && !normalizedStatus.equals("DONE")) {
            throw new CustomException(400, "유효하지 않은 상태값입니다. PENDING, IN_PROGRESS, DONE 중 하나여야 합니다.");
        }
        jdbcTemplate.update(
            "UPDATE work_report_feedback SET status = ?, updated_at = now() WHERE id = ?",
            normalizedStatus, id);
        return getFeedback(id);
    }

    public void deleteFeedback(Long id, AuthUser user) {
        ensureAccess(id, user);
        jdbcTemplate.update("DELETE FROM work_report_feedback WHERE id = ?", id);
    }

    private Map<String, Object> getFeedback(Long id) {
        return jdbcTemplate.queryForMap("SELECT * FROM work_report_feedback WHERE id = ?", id);
    }

    private void ensureAccess(Long id, AuthUser user) {
        if (UserRole.from(user.role()) == UserRole.EXECUTIVE) return;
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM work_report_feedback WHERE id = ? AND LOWER(author_username) = LOWER(?)",
            Integer.class, id, user.username());
        if (count == null || count == 0) throw new CustomException(403, "본인 피드백만 수정할 수 있습니다.");
    }

    private static String extractMentions(String content) {
        if (content == null) return null;
        List<String> mentions = Arrays.stream(content.split("\\s+"))
            .filter(word -> word.startsWith("@") && word.length() > 1)
            .map(word -> word.substring(1).replaceAll("[^a-zA-Z0-9\uAC00-\uD7A3_]", ""))
            .filter(name -> !name.isEmpty())
            .distinct()
            .collect(Collectors.toList());
        return mentions.isEmpty() ? null : String.join(",", mentions);
    }

    private static String blankToNull(Object value) {
        if (value == null) return null;
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }
                 }
