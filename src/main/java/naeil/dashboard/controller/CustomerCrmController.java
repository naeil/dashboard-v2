package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.CustomerCrmService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 고객 구매 데이터 기반 마케팅(CRM) — 대표/매니저 전용.
 * [raw]매출관리 시트를 읽어 고객 세그먼트 + "오늘 실행할" 액션 리스트를 반환한다.
 */
@Slf4j
@RestController
@RequestMapping("/api/executive/customer-crm")
@RequiredArgsConstructor
public class CustomerCrmController {

    private final CustomerCrmService customerCrmService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> analyze(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) String sheetId,
            @RequestParam(defaultValue = "false") boolean individualOnly,
            HttpServletRequest request
    ) {
        ResponseEntity<Map<String, Object>> gate = guard(request);
        if (gate != null) return gate;
        try {
            return ResponseEntity.ok(customerCrmService.analyze(companyId, sheetId, individualOnly));
        } catch (Exception e) {
            log.error("[CustomerCrm] analyze failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "분석 중 오류: " + String.valueOf(e.getMessage())));
        }
    }

    /** 액션 리스트를 실무 업무로 등록 (담당자 지정). body: {assignee, segments[], individualOnly, limit} */
    @PostMapping("/assign")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> assign(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) String sheetId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request
    ) {
        ResponseEntity<Map<String, Object>> gate = guard(request);
        if (gate != null) return gate;
        String assignee = body.get("assignee") == null ? "" : String.valueOf(body.get("assignee"));
        boolean individualOnly = Boolean.parseBoolean(String.valueOf(body.getOrDefault("individualOnly", "false")));
        int limit = 50;
        try { limit = (int) Math.round(Double.parseDouble(String.valueOf(body.getOrDefault("limit", 50)))); } catch (Exception ignore) { }
        List<String> segments = body.get("segments") instanceof List<?> ? (List<String>) body.get("segments") : List.of();
        try {
            return ResponseEntity.ok(customerCrmService.assignToTasks(companyId, sheetId, assignee, segments, individualOnly, limit));
        } catch (Exception e) {
            log.error("[CustomerCrm] assign failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "업무 등록 중 오류: " + String.valueOf(e.getMessage())));
        }
    }

    private ResponseEntity<Map<String, Object>> guard(HttpServletRequest request) {
        AuthUser user = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "로그인이 필요합니다."));
        }
        UserRole role = UserRole.from(user.role());
        // 실무자(직원)도 자기 실행용으로 조회·업무등록 가능. (HR 전용 계정만 제외)
        if (role != UserRole.EXECUTIVE && role != UserRole.MANAGER && role != UserRole.EMPLOYEE) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "접근 권한이 없습니다."));
        }
        return null;
    }
}
