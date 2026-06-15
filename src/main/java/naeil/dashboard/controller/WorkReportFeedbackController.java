package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.WorkReportFeedbackService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/staff/work-reports")
@RequiredArgsConstructor
public class WorkReportFeedbackController {

    private final WorkReportFeedbackService workReportFeedbackService;

    @GetMapping("/{reportId}/feedback")
    public ResponseEntity<List<Map<String, Object>>> listFeedbacks(@PathVariable Long reportId) {
        return ResponseEntity.ok(workReportFeedbackService.listFeedbacks(reportId));
    }

    @PostMapping("/{reportId}/feedback")
    public ResponseEntity<Map<String, Object>> createFeedback(
        @PathVariable Long reportId,
        @RequestBody Map<String, Object> payload,
        HttpServletRequest request
    ) {
        return ResponseEntity.ok(workReportFeedbackService.createFeedback(reportId, requireUser(request), payload));
    }

    @PutMapping("/feedback/{id}")
    public ResponseEntity<Map<String, Object>> updateFeedback(
        @PathVariable Long id,
        @RequestBody Map<String, Object> payload,
        HttpServletRequest request
    ) {
        return ResponseEntity.ok(workReportFeedbackService.updateFeedback(id, requireUser(request), payload));
    }

    @DeleteMapping("/feedback/{id}")
    public ResponseEntity<Map<String, String>> deleteFeedback(
        @PathVariable Long id,
        HttpServletRequest request
    ) {
        workReportFeedbackService.deleteFeedback(id, requireUser(request));
        return ResponseEntity.ok(Map.of("message", "\uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4."));
    }

    private AuthUser requireUser(HttpServletRequest request) {
        return (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
    }
}
