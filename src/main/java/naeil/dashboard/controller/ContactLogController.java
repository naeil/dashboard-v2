package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AgentActivityService;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.ContactLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 상담·미팅 기록 API.
 * - /api/contact-logs/** : 로그인한 직원 누구나 (작성자는 created_by에 남는다)
 * - /api/agent/ingest/contact-logs : 회사 PC 에이전트 전용 (X-Agent-Key, AuthInterceptor 화이트리스트)
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ContactLogController {

    private static final Long COMPANY = 1L;
    private static final String KEY_HEADER = "X-Agent-Key";

    private final ContactLogService contactLogService;
    private final AgentActivityService agentActivityService;

    // ===== 사용자 =====

    @GetMapping("/contact-logs")
    public ResponseEntity<List<Map<String, Object>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String staff,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "200") int limit) {
        return ResponseEntity.ok(contactLogService.list(COMPANY, q, staff, status, type, from, to, limit));
    }

    @GetMapping("/contact-logs/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable Long id) {
        return ResponseEntity.ok(contactLogService.get(COMPANY, id));
    }

    @PostMapping("/contact-logs")
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        AuthUser actor = requireUser(request);
        return ResponseEntity.ok(contactLogService.create(COMPANY, body, "MANUAL", nameOf(actor)));
    }

    @PutMapping("/contact-logs/{id}")
    public ResponseEntity<Map<String, Object>> update(
            @PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        requireUser(request);
        return ResponseEntity.ok(contactLogService.update(COMPANY, id, body));
    }

    @PatchMapping("/contact-logs/{id}/status")
    public ResponseEntity<Map<String, Object>> status(
            @PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        requireUser(request);
        Object status = body == null ? null : body.get("status");
        return ResponseEntity.ok(contactLogService.updateStatus(COMPANY, id, status == null ? null : String.valueOf(status)));
    }

    @DeleteMapping("/contact-logs/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable Long id, HttpServletRequest request) {
        requireUser(request);
        return ResponseEntity.ok(contactLogService.delete(COMPANY, id));
    }

    // ===== 에이전트 =====

    /** 최근 기록 조회(읽기 전용) — 운영·관제 키 모두 허용. since가 없으면 최근 7일. */
    @GetMapping("/agent/ingest/contact-logs")
    public ResponseEntity<List<Map<String, Object>>> agentList(
            @RequestHeader(value = KEY_HEADER, required = false) String key,
            @RequestParam(required = false) String since,
            @RequestParam(defaultValue = "200") int limit) {
        agentActivityService.resolveKey(key);
        return ResponseEntity.ok(contactLogService.since(COMPANY, since, limit));
    }

    /** 에이전트가 기록 추가(source = AGENT) — 운영 키만. */
    @PostMapping("/agent/ingest/contact-logs")
    public ResponseEntity<Map<String, Object>> agentCreate(
            @RequestHeader(value = KEY_HEADER, required = false) String key,
            @RequestBody Map<String, Object> body) {
        agentActivityService.requireAgentKey(key);
        Object by = body == null ? null : body.getOrDefault("createdBy", body.get("agentName"));
        String createdBy = by == null || String.valueOf(by).isBlank() ? "AI 에이전트" : String.valueOf(by);
        return ResponseEntity.ok(contactLogService.create(COMPANY, body, "AGENT", createdBy));
    }

    private AuthUser requireUser(HttpServletRequest request) {
        AuthUser actor = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
        if (actor == null) throw new CustomException(401, "로그인이 필요합니다.");
        return actor;
    }

    private static String nameOf(AuthUser actor) {
        return actor.displayName() == null || actor.displayName().isBlank() ? actor.username() : actor.displayName();
    }
}
