package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.IncentiveDto;
import naeil.dashboard.service.IncentiveService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/incentives")
@RequiredArgsConstructor
public class IncentiveController {

    private final IncentiveService incentiveService;

    // ==================== 온라인 성과 ====================

    @GetMapping("/online")
    public ResponseEntity<List<IncentiveDto.OnlinePerformanceResponse>> getOnlinePerformances(
            @RequestParam(required = false) String month) {
        return ResponseEntity.ok(incentiveService.getOnlinePerformances(month));
    }

    @PostMapping("/online")
    public ResponseEntity<IncentiveDto.OnlinePerformanceResponse> createOnlinePerformance(
            @RequestBody IncentiveDto.OnlinePerformanceRequest request) {
        return ResponseEntity.ok(incentiveService.createOnlinePerformance(request));
    }

    @PutMapping("/online/{id}")
    public ResponseEntity<IncentiveDto.OnlinePerformanceResponse> updateOnlinePerformance(
            @PathVariable Long id,
            @RequestBody IncentiveDto.OnlinePerformanceRequest request) {
        return ResponseEntity.ok(incentiveService.updateOnlinePerformance(id, request));
    }

    @DeleteMapping("/online/{id}")
    public ResponseEntity<Void> deleteOnlinePerformance(@PathVariable Long id) {
        incentiveService.deleteOnlinePerformance(id);
        return ResponseEntity.noContent().build();
    }

    // ==================== 거래처 성과 ====================

    @GetMapping("/clients")
    public ResponseEntity<List<IncentiveDto.ClientPerformanceResponse>> getClientPerformances(
            @RequestParam(required = false) String month) {
        return ResponseEntity.ok(incentiveService.getClientPerformances(month));
    }

    @PostMapping("/clients")
    public ResponseEntity<IncentiveDto.ClientPerformanceResponse> createClientPerformance(
            @RequestBody IncentiveDto.ClientPerformanceRequest request) {
        return ResponseEntity.ok(incentiveService.createClientPerformance(request));
    }

    @PutMapping("/clients/{id}")
    public ResponseEntity<IncentiveDto.ClientPerformanceResponse> updateClientPerformance(
            @PathVariable Long id,
            @RequestBody IncentiveDto.ClientPerformanceRequest request) {
        return ResponseEntity.ok(incentiveService.updateClientPerformance(id, request));
    }

    @DeleteMapping("/clients/{id}")
    public ResponseEntity<Void> deleteClientPerformance(@PathVariable Long id) {
        incentiveService.deleteClientPerformance(id);
        return ResponseEntity.noContent().build();
    }

    // ==================== 직원별 예상 인센티브 요약 ====================

    @GetMapping("/summary")
    public ResponseEntity<List<IncentiveDto.IncentiveSummaryResponse>> getIncentiveSummary(
            @RequestParam(required = false) String month) {
        return ResponseEntity.ok(incentiveService.getIncentiveSummary(month));
    }

    @PatchMapping("/summary/{id}/status")
    public ResponseEntity<IncentiveDto.IncentiveSummaryResponse> updateSummaryStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload) {
        return ResponseEntity.ok(incentiveService.updateSummaryStatus(id, payload.get("status")));
    }

    // ==================== KPI ====================

    @GetMapping("/kpi")
    public ResponseEntity<IncentiveDto.IncentiveKpiResponse> getKpi(
            @RequestParam(required = false) String month) {
        return ResponseEntity.ok(incentiveService.getKpi(month));
    }
}
