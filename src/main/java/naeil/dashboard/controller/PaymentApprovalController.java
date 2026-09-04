package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.PaymentApprovalService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 지출결의 전자결재 API — 기안 · 결재함 · 승인/반려 · 결재선 후보.
 */
@RestController
@RequestMapping("/api/payment-approval")
@RequiredArgsConstructor
public class PaymentApprovalController {

    private static final Long COMPANY = 1L;
    private final PaymentApprovalService paymentApprovalService;

    @GetMapping("/approvers")
    public ResponseEntity<List<Map<String, Object>>> approvers() {
        return ResponseEntity.ok(paymentApprovalService.approvers(COMPANY));
    }

    @PostMapping("/submit")
    public ResponseEntity<Map<String, Object>> submit(@RequestBody Map<String, Object> payload, HttpServletRequest request) {
        return ResponseEntity.ok(paymentApprovalService.submit(COMPANY, user(request), payload));
    }

    @GetMapping("/inbox")
    public ResponseEntity<List<Map<String, Object>>> inbox(HttpServletRequest request) {
        return ResponseEntity.ok(paymentApprovalService.inbox(COMPANY, user(request)));
    }

    @GetMapping("/mine")
    public ResponseEntity<List<Map<String, Object>>> mine(HttpServletRequest request) {
        return ResponseEntity.ok(paymentApprovalService.mine(COMPANY, user(request)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> detail(@PathVariable Long id) {
        return ResponseEntity.ok(paymentApprovalService.detail(COMPANY, id));
    }

    @PostMapping("/{id}/act")
    public ResponseEntity<Map<String, Object>> act(
            @PathVariable Long id, @RequestBody Map<String, Object> payload, HttpServletRequest request) {
        String action = String.valueOf(payload.getOrDefault("action", "APPROVE"));
        String comment = payload.get("comment") == null ? null : String.valueOf(payload.get("comment"));
        return ResponseEntity.ok(paymentApprovalService.act(COMPANY, id, user(request), action, comment));
    }

    private static AuthUser user(HttpServletRequest request) {
        return (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
    }
}
