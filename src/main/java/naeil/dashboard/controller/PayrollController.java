package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.PayrollDto;
import naeil.dashboard.service.PayrollService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payroll")
@RequiredArgsConstructor
public class PayrollController {

    private final PayrollService payrollService;

    /** 급여 목록 조회 */
    @GetMapping
    public ResponseEntity<List<PayrollDto.RecordResponse>> getRecords(
            @RequestParam(required = false) String payYearMonth) {
        return ResponseEntity.ok(payrollService.getRecords(payYearMonth));
    }

    /** 업로드된 월 목록 조회 */
    @GetMapping("/months")
    public ResponseEntity<List<String>> getAvailableMonths() {
        return ResponseEntity.ok(payrollService.getAvailableMonths());
    }

    /** 엑셀 업로드 */
    @PostMapping("/upload")
    public ResponseEntity<PayrollDto.UploadResult> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("payYearMonth") String payYearMonth) throws Exception {
        return ResponseEntity.ok(payrollService.uploadExcel(file, payYearMonth));
    }

    /** 급여 계산 후 명세서 저장 */
    @PostMapping("/calculate")
    public ResponseEntity<PayrollDto.RecordResponse> calculate(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(payrollService.calculateAndSave(payload));
    }

    /** 특정 월 급여명세서 이메일 발송 */
    @PostMapping("/send")
    public ResponseEntity<PayrollDto.SendResult> send(
            @RequestParam("payYearMonth") String payYearMonth) {
        return ResponseEntity.ok(payrollService.sendPayslips(payYearMonth));
    }

    /** 직원 이메일 등록/수정 */
    @PostMapping("/users/{userId}/email")
    public ResponseEntity<?> updateEmail(
            @PathVariable Long userId,
            @RequestParam String email) {
        payrollService.updateUserEmail(userId, email);
        return ResponseEntity.ok(Map.of("message", "이메일이 등록되었습니다."));
    }

    /**
     * 출퇴근 기록 기반 근무 데이터 자동 조회 (시급제 전용)
     * GET /api/payroll/attendance-summary?payYearMonth=2026-06&userId=3
     */
    @GetMapping("/attendance-summary")
    public ResponseEntity<PayrollDto.AttendanceSummary> getAttendanceSummary(
            @RequestParam String payYearMonth,
            @RequestParam Long userId) {
        return ResponseEntity.ok(payrollService.getAttendanceSummary(payYearMonth, userId));
    }
}
