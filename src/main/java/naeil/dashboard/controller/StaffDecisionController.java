package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AgentActivityService;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.StaffDecisionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** 관제실 '실무진 판단 필요' 카드 판단 API — 로그인 직원 누구나, 판단한 사람 이름이 남는다. 에이전트는 읽기만. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class StaffDecisionController {

    private static final Long COMPANY = 1L;

    private final StaffDecisionService staffDecisionService;
    private final AgentActivityService agentActivityService;

    @GetMapping("/staff-decisions")
    public ResponseEntity<List<Map<String, Object>>> latest() {
        return ResponseEntity.ok(staffDecisionService.latest(COMPANY));
    }

    /** { itemKey, kind, partnerName, partnerEmail, ownerName, status: APPROVED|RUNNING|HOLD|REJECTED, reason, nextSteps, details } */
    @PostMapping("/staff-decisions")
    public ResponseEntity<Map<String, Object>> decide(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        AuthUser actor = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
        if (actor == null) throw new CustomException(401, "로그인이 필요합니다.");
        String name = actor.displayName() == null || actor.displayName().isBlank() ? actor.username() : actor.displayName();
        return ResponseEntity.ok(staffDecisionService.decide(COMPANY, body, name));
    }

    /** 에이전트가 판단 결과를 읽어 후속 처리(보류·거절 건은 다시 독촉하지 않음 등)에 쓴다. */
    @GetMapping("/agent/ingest/staff-decisions")
    public ResponseEntity<List<Map<String, Object>>> agentLatest(@RequestHeader(value = "X-Agent-Key", required = false) String key) {
        agentActivityService.resolveKey(key);
        return ResponseEntity.ok(staffDecisionService.latest(COMPANY));
    }
}
