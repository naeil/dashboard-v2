package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import naeil.dashboard.service.AgentActivityService;
import naeil.dashboard.service.AgentWorkService;
import naeil.dashboard.service.AgentMonitorService;
import naeil.dashboard.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * AI 에이전트 활동 패널 API.
 * - /api/agent/ingest/** : 회사 PC 에이전트 전용 (JWT 대신 X-Agent-Key, AuthInterceptor 화이트리스트)
 * - /api/agent/activities/** : 로그인 사용자용 조회 · 승인/반려
 */
@RestController
@RequestMapping("/api/agent")
@RequiredArgsConstructor
public class AgentActivityController {

    private static final Long COMPANY = 1L;
    private static final String KEY_HEADER = "X-Agent-Key";

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private final AgentActivityService agentActivityService;
    private final AgentWorkService agentWorkService;
    private final AuthService authService;
    private final AgentMonitorService agentMonitorService;

    // ===== 에이전트 =====

    @PostMapping("/ingest/activities")
    public ResponseEntity<Map<String, Object>> create(
            @RequestHeader(value = KEY_HEADER, required = false) String key,
            @RequestBody Map<String, Object> body) {
        AgentActivityService.KeyRole role = agentActivityService.resolveKey(key);
        return ResponseEntity.ok(agentActivityService.create(COMPANY, body, role));
    }

    @PatchMapping("/ingest/activities/{id}")
    public ResponseEntity<Map<String, Object>> update(
            @RequestHeader(value = KEY_HEADER, required = false) String key,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        agentActivityService.requireAgentKey(key);
        return ResponseEntity.ok(agentActivityService.agentUpdate(COMPANY, id, body));
    }

    @PostMapping("/ingest/heartbeat")
    public ResponseEntity<Map<String, Object>> heartbeat(
            @RequestHeader(value = KEY_HEADER, required = false) String key,
            @RequestBody Map<String, Object> body) {
        agentActivityService.resolveKey(key);
        agentActivityService.heartbeat(COMPANY, body);
        return ResponseEntity.ok(Map.of("success", true));
    }

    /** AI 관제실 보드에 업무 현황 스냅샷을 올린다 — 운영·관제 키 모두 허용. */
    @PostMapping("/ingest/board")
    public ResponseEntity<Map<String, Object>> board(
            @RequestHeader(value = KEY_HEADER, required = false) String key,
            @RequestBody Map<String, Object> body) {
        agentActivityService.resolveKey(key);
        agentActivityService.board(COMPANY, body);
        return ResponseEntity.ok(Map.of("success", true));
    }

    /** 관제용 상태 요약(읽기 전용) — 운영·관제 키 모두 허용. */
    @GetMapping("/ingest/status-summary")
    public ResponseEntity<Map<String, Object>> statusSummary(
            @RequestHeader(value = KEY_HEADER, required = false) String key) {
        agentActivityService.resolveKey(key);
        return ResponseEntity.ok(agentMonitorService.statusSummary(COMPANY));
    }

    @GetMapping("/ingest/decisions")
    public ResponseEntity<List<Map<String, Object>>> decisions(
            @RequestHeader(value = KEY_HEADER, required = false) String key,
            @RequestParam(required = false) String agentName) {
        agentActivityService.requireAgentKey(key);
        return ResponseEntity.ok(agentActivityService.pendingDecisions(COMPANY, agentName));
    }

    @GetMapping("/ingest/work-context")
    public ResponseEntity<Map<String, Object>> workContext(
            @RequestHeader(value = KEY_HEADER, required = false) String key,
            @RequestParam(required = false) String date) {
        agentActivityService.requireAgentKey(key);
        LocalDate target = date == null || date.isBlank() ? LocalDate.now(SEOUL) : LocalDate.parse(date);
        return ResponseEntity.ok(agentWorkService.workContext(COMPANY, target));
    }

    @PostMapping("/ingest/work-directives")
    public ResponseEntity<Map<String, Object>> createDirective(
            @RequestHeader(value = KEY_HEADER, required = false) String key,
            @RequestBody Map<String, Object> body) {
        agentActivityService.requireAgentKey(key);
        return ResponseEntity.ok(agentWorkService.createDirective(COMPANY, body));
    }

    // ===== 사용자 =====

    @GetMapping("/activities")
    public ResponseEntity<Map<String, Object>> overview(@RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(agentActivityService.overview(COMPANY, limit));
    }

    /** AI 관제실 화면: 운영·관제 현황과 시간대별 그래프 데이터 (매출 포함이라 관리자 이상). */
    @GetMapping("/control-room")
    public ResponseEntity<Map<String, Object>> controlRoom(HttpServletRequest request) {
        requireManager(request);
        return ResponseEntity.ok(agentMonitorService.controlRoom(COMPANY));
    }

    @PostMapping("/activities/{id}/approve")
    public ResponseEntity<Map<String, Object>> approve(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request) {
        AuthUser actor = requireManager(request);
        return ResponseEntity.ok(agentActivityService.decide(COMPANY, id, true, comment(body), actor.username()));
    }

    @PostMapping("/activities/{id}/reject")
    public ResponseEntity<Map<String, Object>> reject(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            HttpServletRequest request) {
        AuthUser actor = requireManager(request);
        return ResponseEntity.ok(agentActivityService.decide(COMPANY, id, false, comment(body), actor.username()));
    }

    private AuthUser requireManager(HttpServletRequest request) {
        AuthUser actor = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
        authService.requireRole(actor, UserRole.MANAGER);
        return actor;
    }

    private static String comment(Map<String, Object> body) {
        return body == null || body.get("comment") == null ? null : String.valueOf(body.get("comment"));
    }
}
