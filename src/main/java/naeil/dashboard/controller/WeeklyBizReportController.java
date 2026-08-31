package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.WeeklyBizReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@RequestMapping("/api/weekly-biz")
@RequiredArgsConstructor
public class WeeklyBizReportController {

    private final WeeklyBizReportService weeklyBizReportService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(weeklyBizReportService.list(companyId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(
            @RequestParam(defaultValue = "1") Long companyId, @PathVariable Long id) {
        return ResponseEntity.ok(weeklyBizReportService.get(companyId, id));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> upload(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String weekStart,
            @RequestParam(required = false) String title,
            HttpServletRequest request
    ) {
        try {
            AuthUser user = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
            return ResponseEntity.ok(weeklyBizReportService.upload(
                    companyId, user, weekStart, title, file.getBytes(), file.getOriginalFilename()));
        } catch (Exception e) {
            log.error("[WeeklyBiz] upload failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", String.valueOf(e.getMessage())));
        }
    }

    @PostMapping("/{id}/analyze")
    public ResponseEntity<Map<String, Object>> analyze(
            @RequestParam(defaultValue = "1") Long companyId, @PathVariable Long id) {
        return ResponseEntity.ok(weeklyBizReportService.analyze(companyId, id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(
            @RequestParam(defaultValue = "1") Long companyId, @PathVariable Long id, HttpServletRequest request
    ) {
        AuthUser user = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
        return ResponseEntity.ok(weeklyBizReportService.delete(companyId, id, user));
    }
}
