package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.StaffAttendanceService;
import naeil.dashboard.service.StaffTaskCategoryService;
import naeil.dashboard.service.StaffWorkReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffWorkReportService staffWorkReportService;
    private final StaffTaskCategoryService staffTaskCategoryService;
    private final StaffAttendanceService staffAttendanceService;

    @GetMapping("/work-reports")
    public ResponseEntity<List<Map<String, Object>>> listReports(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) String reportType,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(staffWorkReportService.listReports(companyId, requireUser(request), reportType));
    }

    @PostMapping("/work-reports")
    public ResponseEntity<Map<String, Object>> createReport(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(staffWorkReportService.createReport(companyId, requireUser(request), payload));
    }

    @PutMapping("/work-reports/{id}")
    public ResponseEntity<Map<String, Object>> updateReport(
            @PathVariable Long id,
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(staffWorkReportService.updateReport(id, requireUser(request), payload));
    }

    @DeleteMapping("/work-reports/{id}")
    public ResponseEntity<Map<String, String>> deleteReport(@PathVariable Long id, HttpServletRequest request) {
        staffWorkReportService.deleteReport(id, requireUser(request));
        return ResponseEntity.ok(Map.of("message", "삭제되었습니다."));
    }

    @GetMapping("/task-categories")
    public ResponseEntity<List<Map<String, Object>>> listTaskCategories(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(staffTaskCategoryService.listCategories(companyId));
    }

    @PostMapping("/task-categories")
    public ResponseEntity<Map<String, Object>> createTaskCategory(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(staffTaskCategoryService.createCategory(companyId, requireUser(request), payload));
    }

    @PutMapping("/task-categories/{id}")
    public ResponseEntity<Map<String, Object>> updateTaskCategory(
            @PathVariable Long id,
            @RequestBody Map<String, Object> payload
    ) {
        return ResponseEntity.ok(staffTaskCategoryService.updateCategory(id, payload));
    }

    @DeleteMapping("/task-categories/{id}")
    public ResponseEntity<Map<String, String>> deleteTaskCategory(@PathVariable Long id) {
        staffTaskCategoryService.deleteCategory(id);
        return ResponseEntity.ok(Map.of("message", "삭제되었습니다."));
    }

    @GetMapping("/attendance/today")
    public ResponseEntity<Map<String, Object>> getTodayAttendance(
            @RequestParam(defaultValue = "1") Long companyId,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(staffAttendanceService.getToday(companyId, requireUser(request)));
    }

    @GetMapping("/attendance")
    public ResponseEntity<List<Map<String, Object>>> listAttendance(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate month,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(staffAttendanceService.listMonth(companyId, requireUser(request), month));
    }

    @GetMapping("/attendance/admin")
    public ResponseEntity<List<Map<String, Object>>> listAdminAttendance(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate month,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(staffAttendanceService.listAdminAttendance(companyId, requireUser(request), month));
    }

    @PostMapping("/attendance/clock")
    public ResponseEntity<Map<String, Object>> clockAttendance(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(staffAttendanceService.clock(
                companyId,
                requireUser(request),
                String.valueOf(payload.get("action")),
                clientIp(request),
                request.getHeader("User-Agent")
        ));
    }

    private AuthUser requireUser(HttpServletRequest request) {
        return (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
    }

    private String clientIp(HttpServletRequest request) {
        String[] headerNames = {
                "X-Forwarded-For",
                "X-Real-IP",
                "CF-Connecting-IP",
                "Proxy-Client-IP",
                "WL-Proxy-Client-IP"
        };
        for (String headerName : headerNames) {
            String value = request.getHeader(headerName);
            if (value != null && !value.isBlank() && !"unknown".equalsIgnoreCase(value)) {
                return value.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr();
    }
}
