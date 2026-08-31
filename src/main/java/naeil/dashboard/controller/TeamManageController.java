package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.TeamManageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/team")
@RequiredArgsConstructor
public class TeamManageController {

    private final TeamManageService teamManageService;

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> overview(
            @RequestParam(defaultValue = "1") Long companyId, HttpServletRequest request) {
        return ResponseEntity.ok(teamManageService.getOverview(companyId, requireUser(request)));
    }

    @GetMapping("/reports/{reportId}/comments")
    public ResponseEntity<List<Map<String, Object>>> comments(
            @RequestParam(defaultValue = "1") Long companyId, @PathVariable Long reportId) {
        return ResponseEntity.ok(teamManageService.listComments(companyId, reportId));
    }

    @PostMapping("/reports/{reportId}/comments")
    public ResponseEntity<Map<String, Object>> addComment(
            @RequestParam(defaultValue = "1") Long companyId,
            @PathVariable Long reportId,
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request
    ) {
        String content = payload.get("content") == null ? "" : String.valueOf(payload.get("content"));
        return ResponseEntity.ok(teamManageService.addComment(companyId, reportId, requireUser(request), content));
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Map<String, Object>> deleteComment(
            @RequestParam(defaultValue = "1") Long companyId, @PathVariable Long id, HttpServletRequest request) {
        return ResponseEntity.ok(teamManageService.deleteComment(companyId, id, requireUser(request)));
    }

    private AuthUser requireUser(HttpServletRequest request) {
        return (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
    }
}
