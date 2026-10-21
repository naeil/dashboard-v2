package naeil.dashboard.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그인 알림: 나에게 온 업무 지시·피드백(업무 보고)과 새로 배정된 업무 중 아직 '확인'하지 않은 것.
 * 담당자 이름(display_name) 또는 아이디(username)로 찾고, 확인하면 user_notice_seen 에 남겨 다시 띄우지 않는다.
 */
@Service
@RequiredArgsConstructor
public class MyNoticeService {

    private final JdbcTemplate jdbcTemplate;

    public Map<String, Object> unseen(Long companyId, String username, String displayName) {
        String name = displayName == null || displayName.isBlank() ? username : displayName;
        List<Map<String, Object>> feedback = jdbcTemplate.queryForList("""
                SELECT f.id, f.content, f.feedback_type, f.status, TO_CHAR(f.due_date, 'YYYY-MM-DD') AS due_date,
                       COALESCE(f.author_display_name, f.author_username) AS author,
                       TO_CHAR(f.created_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS created_at,
                       r.title AS report_title, TO_CHAR(r.report_date, 'YYYY-MM-DD') AS report_date,
                       COALESCE(r.display_name, r.username) AS report_owner
                FROM work_report_feedback f
                LEFT JOIN staff_work_report r ON r.id = f.report_id
                WHERE f.company_id = ?
                  AND COALESCE(UPPER(f.status), 'PENDING') NOT IN ('DONE', 'COMPLETED', 'CANCELLED', 'RESOLVED')
                  AND (f.assignee_name IN (?, ?)
                       OR (',' || REPLACE(COALESCE(f.mentioned_usernames, ''), ' ', '') || ',') LIKE ?
                       OR (f.assignee_name IS NULL AND LOWER(r.username) = LOWER(?) AND LOWER(f.author_username) <> LOWER(?)))
                  AND NOT EXISTS (SELECT 1 FROM user_notice_seen s WHERE s.company_id = f.company_id
                                  AND s.username = ? AND s.item_type = 'FEEDBACK' AND s.item_id = f.id)
                ORDER BY f.created_at DESC
                LIMIT 50
                """, companyId, name, username, "%," + username + ",%", username, username, username);
        List<Map<String, Object>> tasks = jdbcTemplate.queryForList("""
                SELECT t.id, t.project_name, t.task_name, t.priority, t.status, TO_CHAR(t.due_date, 'YYYY-MM-DD') AS due_date,
                       t.source_type, TO_CHAR(t.created_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS created_at
                FROM executive_work_task t
                WHERE t.company_id = ? AND t.assignee_name IN (?, ?)
                  AND t.completed_date IS NULL AND COALESCE(t.status, '') NOT IN ('DONE', 'COMPLETED', 'CANCELLED')
                  AND t.created_at >= NOW() - INTERVAL '14 days'
                  AND NOT EXISTS (SELECT 1 FROM user_notice_seen s WHERE s.company_id = t.company_id
                                  AND s.username = ? AND s.item_type = 'TASK' AND s.item_id = t.id)
                ORDER BY t.due_date NULLS LAST, t.created_at DESC
                LIMIT 80
                """, companyId, name, username, username);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("feedback", feedback);
        out.put("tasks", tasks);
        out.put("count", feedback.size() + tasks.size());
        return out;
    }

    /** body.items = [{type: FEEDBACK|TASK, id}] — 확인 처리. */
    @Transactional
    public Map<String, Object> markSeen(Long companyId, String username, Object items) {
        if (!(items instanceof List<?> list)) throw new CustomException(400, "확인할 항목이 없습니다.");
        int n = 0;
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> m)) continue;
            String type = String.valueOf(m.get("type")).toUpperCase();
            if (!"FEEDBACK".equals(type) && !"TASK".equals(type)) continue;
            long id;
            try { id = Long.parseLong(String.valueOf(m.get("id"))); } catch (NumberFormatException e) { continue; }
            n += jdbcTemplate.update("""
                    INSERT INTO user_notice_seen (company_id, username, item_type, item_id) VALUES (?, ?, ?, ?)
                    ON CONFLICT DO NOTHING
                    """, companyId, username, type, id);
        }
        return Map.of("seen", n);
    }
}
