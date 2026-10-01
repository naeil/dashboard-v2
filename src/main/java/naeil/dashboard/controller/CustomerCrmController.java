package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.CustomerCrmService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
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
            HttpServletRequest request
    ) {
        AuthUser user = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "로그인이 필요합니다."));
        }
        UserRole role = UserRole.from(user.role());
        if (role != UserRole.EXECUTIVE && role != UserRole.MANAGER) {
            return ResponseEntity.status(403).body(Map.of("success", false, "message", "대표/매니저 권한이 필요합니다."));
        }
        try {
            return ResponseEntity.ok(customerCrmService.analyze(companyId, sheetId));
        } catch (Exception e) {
            log.error("[CustomerCrm] analyze failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "분석 중 오류: " + String.valueOf(e.getMessage())));
        }
    }
}
