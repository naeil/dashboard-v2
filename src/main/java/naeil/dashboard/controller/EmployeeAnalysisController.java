package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.EmployeeAnalysisService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 직원 성과 AI 분석 Controller
 *
 * GET  /api/employee-analysis/detail?companyId=1&username=xxx
 *   → 직원 상세 업무 데이터 (tasks, reports, categoryBreakdown, stats)
 *
 * POST /api/employee-analysis/analyze?companyId=1
 *   body: { username, displayName }
 *   → AI 분석 실행 및 결과 저장
 *
 * GET  /api/employee-analysis/history?companyId=1&username=xxx
 *   → 분석 이력 목록
 *
 * PUT  /api/employee-analysis/{id}/feedback
 *   body: { feedback }
 *   → 대표 피드백 저장
 */
@RestController
@RequestMapping("/api/employee-analysis")
@RequiredArgsConstructor
public class EmployeeAnalysisController {

    private final EmployeeAnalysisService employeeAnalysisService;
    private final AuthService authService;

    /** 직원 상세 업무 데이터 조회 */
    @GetMapping("/detail")
    public ResponseEntity<Map<String, Object>> getDetail(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam String username
    ) {
        return ResponseEntity.ok(employeeAnalysisService.getEmployeeDetail(companyId, username));
    }

    /** AI 분석 실행 */
    @PostMapping("/analyze")
    public ResponseEntity<Map<String, Object>> analyze(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> body
    ) {
        String username    = require(body.get("username"),    "username 이 필요합니다.");
        String displayName = strOrDefault(body.get("displayName"), username);
        return ResponseEntity.ok(
            employeeAnalysisService.analyzeEmployee(companyId, username, displayName)
        );
    }

    /** 분석 이력 조회 */
    @GetMapping("/history")
    public ResponseEntity<List<Map<String, Object>>> listHistory(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) String username
    ) {
        return ResponseEntity.ok(employeeAnalysisService.listAnalyses(companyId, username));
    }

    /** 분석 단건 조회 */
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(employeeAnalysisService.getAnalysis(id));
    }

    /** 대표 피드백 저장 */
    @PutMapping("/{id}/feedback")
    public ResponseEntity<Map<String, Object>> saveFeedback(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request
    ) {
        AuthUser user = getUser(request);
        String feedback   = require(body.get("feedback"), "피드백 내용을 입력해주세요.");
        String feedbackBy = user != null ? user.displayName() : "대표";
        return ResponseEntity.ok(
            employeeAnalysisService.saveFeedback(id, feedback, feedbackBy)
        );
    }

    // ── 헬퍼 ───────────────────────────────────────────────────────────────

    private AuthUser getUser(HttpServletRequest request) {
        try { return authService.resolveUser(request); }
        catch (Exception e) { return null; }
    }

    private String require(Object val, String msg) {
        if (val == null || val.toString().isBlank())
            throw new naeil.dashboard.common.exception.CustomException(400, msg);
        return val.toString().trim();
    }

    private String strOrDefault(Object val, String def) {
        if (val == null || val.toString().isBlank()) return def;
        return val.toString().trim();
    }
}
