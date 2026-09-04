package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 인앱 알림 API — 목록 · 안읽음 수 · 읽음 처리.
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private static final Long COMPANY = 1L;
    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(HttpServletRequest request) {
        AuthUser u = user(request);
        List<Map<String, Object>> items = notificationService.list(COMPANY, u.username());
        int unread = notificationService.unreadCount(COMPANY, u.username());
        return ResponseEntity.ok(Map.of("items", items, "unread", unread));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Object>> unreadCount(HttpServletRequest request) {
        return ResponseEntity.ok(Map.of("unread", notificationService.unreadCount(COMPANY, user(request).username())));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Map<String, Object>> read(@PathVariable Long id, HttpServletRequest request) {
        notificationService.markRead(COMPANY, id, user(request).username());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/read-all")
    public ResponseEntity<Map<String, Object>> readAll(HttpServletRequest request) {
        notificationService.markAllRead(COMPANY, user(request).username());
        return ResponseEntity.ok(Map.of("success", true));
    }

    private static AuthUser user(HttpServletRequest request) {
        return (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
    }
}
