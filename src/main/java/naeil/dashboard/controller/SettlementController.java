package naeil.dashboard.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.service.SettlementService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settlements")
@RequiredArgsConstructor
public class SettlementController {

    private final SettlementService settlementService;

    /**
     * GET /api/settlements/realtime-sales
     * 채널별 실시간 매출 및 정산 예정 데이터 조회
     */
    @GetMapping("/realtime-sales")
    public ResponseEntity<List<Map<String, Object>>> getRealtimeSales(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return ResponseEntity.ok(settlementService.getRealtimeSales(companyId, channel, startDate, endDate));
    }

    /**
     * GET /api/settlements/expected
     * 거래처별 정산 예정 목록 조회
     */
    @GetMapping("/expected")
    public ResponseEntity<List<Map<String, Object>>> getExpectedSettlements(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(settlementService.getExpectedSettlements(companyId, startDate, endDate, channel, status));
    }

    /**
     * GET /api/settlements/summary
     * 정산 요약 카드 데이터 (오늘/이번주/이번달 입금 예정 등)
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSettlementSummary(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return ResponseEntity.ok(settlementService.getSettlementSummary(companyId, startDate, endDate));
    }

    /**
     * GET /api/settlements/deposit-calendar
     * 날짜별 입금 예정 캘린더 데이터
     */
    @GetMapping("/deposit-calendar")
    public ResponseEntity<List<Map<String, Object>>> getDepositCalendar(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String channel
    ) {
        return ResponseEntity.ok(settlementService.getDepositCalendar(companyId, startDate, endDate, channel));
    }

    /**
     * GET /api/settlements/channel-integration-status
     * 채널별 API 연동 상태 조회
     */
    @GetMapping("/channel-integration-status")
    public ResponseEntity<List<Map<String, Object>>> getChannelIntegrationStatus(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(settlementService.getChannelIntegrationStatus(companyId));
    }
}
