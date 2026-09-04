package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.HrService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 인사(HR) API — 직원 명부·인사카드 + 휴가·연차.
 */
@RestController
@RequestMapping("/api/hr")
@RequiredArgsConstructor
public class HrController {

    private static final Long COMPANY = 1L;
    private final HrService hrService;

    @GetMapping("/roster")
    public ResponseEntity<List<Map<String, Object>>> roster(HttpServletRequest request) {
        return ResponseEntity.ok(hrService.roster(COMPANY, user(request)));
    }

    @GetMapping("/card/{id}")
    public ResponseEntity<Map<String, Object>> card(@PathVariable Long id, HttpServletRequest request) {
        return ResponseEntity.ok(hrService.card(COMPANY, id, user(request)));
    }

    @PostMapping("/card/{id}")
    public ResponseEntity<Map<String, Object>> updateCard(
            @PathVariable Long id, @RequestBody Map<String, Object> payload, HttpServletRequest request) {
        return ResponseEntity.ok(hrService.updateCard(COMPANY, id, payload, user(request)));
    }

    /* 휴가·연차 */
    @GetMapping("/leave/my")
    public ResponseEntity<Map<String, Object>> myLeave(HttpServletRequest request) {
        return ResponseEntity.ok(hrService.myLeaveOverview(COMPANY, user(request)));
    }

    @PostMapping("/leave")
    public ResponseEntity<Map<String, Object>> submitLeave(@RequestBody Map<String, Object> payload, HttpServletRequest request) {
        return ResponseEntity.ok(hrService.submitLeave(COMPANY, user(request), payload));
    }

    @GetMapping("/leave/inbox")
    public ResponseEntity<List<Map<String, Object>>> leaveInbox(HttpServletRequest request) {
        return ResponseEntity.ok(hrService.leaveInbox(COMPANY, user(request)));
    }

    @GetMapping("/leave/all")
    public ResponseEntity<List<Map<String, Object>>> leaveAll(HttpServletRequest request) {
        return ResponseEntity.ok(hrService.leaveAll(COMPANY, user(request)));
    }

    @PostMapping("/leave/{id}/act")
    public ResponseEntity<Map<String, Object>> actLeave(
            @PathVariable Long id, @RequestBody Map<String, Object> payload, HttpServletRequest request) {
        String action = String.valueOf(payload.getOrDefault("action", "APPROVE"));
        String comment = payload.get("comment") == null ? null : String.valueOf(payload.get("comment"));
        return ResponseEntity.ok(hrService.actLeave(COMPANY, id, user(request), action, comment));
    }

    private static AuthUser user(HttpServletRequest request) {
        return (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
    }
}
