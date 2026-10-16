package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AgentActivityService;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.GroupBuyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * AI 공동구매 API.
 * - /api/group-buys/** : 로그인한 직원 누구나 (판단한 사람은 decided_by 에 남는다)
 * - /api/agent/ingest/group-buys : 회사 PC 에이전트 전용 (X-Agent-Key)
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class GroupBuyController {

    private static final Long COMPANY = 1L;
    private static final String KEY_HEADER = "X-Agent-Key";

    private final GroupBuyService groupBuyService;
    private final AgentActivityService agentActivityService;

    // ===== 사용자 =====

    @GetMapping("/group-buys")
    public ResponseEntity<List<Map<String, Object>>> list(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(groupBuyService.list(COMPANY, status));
    }

    @GetMapping("/group-buys/schedule")
    public ResponseEntity<List<Map<String, Object>>> schedule(
            @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return ResponseEntity.ok(groupBuyService.schedule(COMPANY, from, to));
    }

    /** 공용 설정: prices(공급가표) · procedure(업무 절차 담당·완료) · confirm(확정 필요 항목). 값은 JSON 문자열. */
    @GetMapping("/group-buys/settings")
    public ResponseEntity<Map<String, Object>> settings() {
        return ResponseEntity.ok(groupBuyService.settings(COMPANY));
    }

    @PutMapping("/group-buys/settings/{key}")
    public ResponseEntity<Map<String, Object>> saveSetting(
            @PathVariable String key, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        AuthUser actor = requireUser(request);
        return ResponseEntity.ok(groupBuyService.saveSetting(COMPANY, key, body == null ? null : body.get("value"), nameOf(actor)));
    }

    @GetMapping("/group-buys/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable Long id) {
        return ResponseEntity.ok(groupBuyService.get(COMPANY, id));
    }

    @PostMapping("/group-buys")
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        requireUser(request);
        return ResponseEntity.ok(groupBuyService.create(COMPANY, body, "MANUAL"));
    }

    @PutMapping("/group-buys/{id}")
    public ResponseEntity<Map<String, Object>> update(
            @PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        requireUser(request);
        return ResponseEntity.ok(groupBuyService.update(COMPANY, id, body));
    }

    /** 조건 판단: { decision: APPROVE|HOLD|REJECT, dealType, commissionRate, salePrice, startDate, endDate, ownerName, memo } */
    @PostMapping("/group-buys/{id}/decide")
    public ResponseEntity<Map<String, Object>> decide(
            @PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        AuthUser actor = requireUser(request);
        return ResponseEntity.ok(groupBuyService.decide(COMPANY, id, body, nameOf(actor)));
    }

    @PatchMapping("/group-buys/{id}/status")
    public ResponseEntity<Map<String, Object>> status(
            @PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        AuthUser actor = requireUser(request);
        Object status = body == null ? null : body.get("status");
        return ResponseEntity.ok(groupBuyService.setStatus(COMPANY, id, status == null ? null : String.valueOf(status), nameOf(actor)));
    }

    @PostMapping("/group-buys/{id}/events")
    public ResponseEntity<Map<String, Object>> addEvent(
            @PathVariable Long id, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        requireUser(request);
        return ResponseEntity.ok(groupBuyService.addEvent(COMPANY, id, body));
    }

    @PatchMapping("/group-buys/events/{eventId}")
    public ResponseEntity<Map<String, Object>> eventDone(
            @PathVariable Long eventId, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        AuthUser actor = requireUser(request);
        boolean done = body != null && Boolean.TRUE.equals(body.get("done"));
        return ResponseEntity.ok(groupBuyService.setEventDone(COMPANY, eventId, done, nameOf(actor)));
    }

    @DeleteMapping("/group-buys/events/{eventId}")
    public ResponseEntity<Map<String, Object>> deleteEvent(@PathVariable Long eventId, HttpServletRequest request) {
        requireUser(request);
        return ResponseEntity.ok(groupBuyService.deleteEvent(COMPANY, eventId));
    }

    // ===== 에이전트 =====

    /** 공구 목록 조회(판단 결과 확인용) — 운영·관제 키 모두 허용. */
    @GetMapping("/agent/ingest/group-buys")
    public ResponseEntity<List<Map<String, Object>>> agentList(
            @RequestHeader(value = KEY_HEADER, required = false) String key,
            @RequestParam(required = false) String status) {
        agentActivityService.resolveKey(key);
        return ResponseEntity.ok(groupBuyService.list(COMPANY, status));
    }

    /** 공구 회신을 '검토 중' 건으로 등록(source_key 같으면 요청 요약만 갱신) — 운영 키만. */
    @PostMapping("/agent/ingest/group-buys")
    public ResponseEntity<Map<String, Object>> agentCreate(
            @RequestHeader(value = KEY_HEADER, required = false) String key,
            @RequestBody Map<String, Object> body) {
        agentActivityService.requireAgentKey(key);
        return ResponseEntity.ok(groupBuyService.create(COMPANY, body, "AGENT"));
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
