package naeil.dashboard.service;

import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 인앱 알림 — 결재 요청/승인/반려 시 담당자에게 뜬다.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final JdbcTemplate jdbcTemplate;

    public void notify(Long companyId, String recipientUsername, String type,
                       String title, String body, String linkPage, Long refId) {
        if (recipientUsername == null || recipientUsername.isBlank()) return;
        jdbcTemplate.update("""
                INSERT INTO user_notification
                (company_id, recipient_username, type, title, body, link_page, ref_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, companyId, recipientUsername, type, title,
                body == null ? null : body.substring(0, Math.min(body.length(), 500)),
                linkPage, refId);
    }

    public List<Map<String, Object>> list(Long companyId, String username) {
        return jdbcTemplate.queryForList("""
                SELECT id, type, title, body, link_page, ref_id, is_read, created_at
                FROM user_notification
                WHERE company_id = ? AND LOWER(recipient_username) = LOWER(?)
                ORDER BY is_read ASC, created_at DESC
                LIMIT 50
                """, companyId, username);
    }

    public int unreadCount(Long companyId, String username) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM user_notification
                WHERE company_id = ? AND LOWER(recipient_username) = LOWER(?) AND is_read = FALSE
                """, Integer.class, companyId, username);
        return count == null ? 0 : count;
    }

    public void markRead(Long companyId, Long id, String username) {
        jdbcTemplate.update("""
                UPDATE user_notification SET is_read = TRUE
                WHERE id = ? AND company_id = ? AND LOWER(recipient_username) = LOWER(?)
                """, id, companyId, username);
    }

    public void markAllRead(Long companyId, String username) {
        jdbcTemplate.update("""
                UPDATE user_notification SET is_read = TRUE
                WHERE company_id = ? AND LOWER(recipient_username) = LOWER(?) AND is_read = FALSE
                """, companyId, username);
    }
}
