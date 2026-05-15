package naeil.dashboard.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.service.ExecutiveDashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.format.annotation.DateTimeFormat;

@RestController
@RequestMapping("/api/executive")
@RequiredArgsConstructor
public class ExecutiveDashboardController {

    private final ExecutiveDashboardService executiveDashboardService;

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getSummary(companyId));
    }

    @GetMapping("/monthly-sales")
    public ResponseEntity<List<Map<String, Object>>> getMonthlySales(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getMonthlySales(companyId));
    }

    @GetMapping("/cash-flow")
    public ResponseEntity<Map<String, Object>> getCashFlow(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getCashFlow(companyId));
    }

    @PostMapping("/cash-flow/import-online-settlements")
    public ResponseEntity<Map<String, Object>> importOnlineSettlements(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return ResponseEntity.ok(executiveDashboardService.importOnlineSettlements(companyId, startDate, endDate));
    }

    @GetMapping("/product-profits")
    public ResponseEntity<List<Map<String, Object>>> getProductProfits(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getProductProfits(companyId));
    }

    @GetMapping("/product-forecasts")
    public ResponseEntity<List<Map<String, Object>>> getProductForecasts(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getProductForecasts(companyId));
    }

    @GetMapping("/channel-sales")
    public ResponseEntity<List<Map<String, Object>>> getChannelSales(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getChannelSales(companyId));
    }

    @GetMapping("/consulting-revenues")
    public ResponseEntity<List<Map<String, Object>>> getConsultingRevenues(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getConsultingRevenues(companyId));
    }

    @GetMapping("/channel-sales/analytics")
    public ResponseEntity<Map<String, Object>> getChannelSalesAnalytics(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return ResponseEntity.ok(executiveDashboardService.getChannelSalesAnalytics(companyId, startDate, endDate));
    }

    @PostMapping("/channel-sales/import-playauto")
    public ResponseEntity<Map<String, Object>> importPlayAutoChannelSales(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "false") boolean refreshOrders
    ) {
        return ResponseEntity.ok(executiveDashboardService.importPlayAutoChannelSales(companyId, startDate, endDate, refreshOrders));
    }

    @GetMapping("/receivables")
    public ResponseEntity<List<Map<String, Object>>> getReceivables(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getReceivables(companyId));
    }

    @GetMapping("/operating-expenses")
    public ResponseEntity<List<Map<String, Object>>> getOperatingExpenses(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getOperatingExpenses(companyId));
    }

    @GetMapping("/debts")
    public ResponseEntity<List<Map<String, Object>>> getDebts(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getDebts(companyId));
    }

    @GetMapping("/export-pipeline")
    public ResponseEntity<List<Map<String, Object>>> getExportPipeline(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getExportPipeline(companyId));
    }

    @GetMapping("/export-supply-prices")
    public ResponseEntity<List<Map<String, Object>>> getExportSupplyPrices(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getExportSupplyPrices(companyId));
    }

    @GetMapping("/ad-performance")
    public ResponseEntity<List<Map<String, Object>>> getAdPerformance(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getAdPerformance(companyId));
    }

    @GetMapping("/issues")
    public ResponseEntity<List<Map<String, Object>>> getIssueLogs(
            @RequestParam(defaultValue = "1") Long companyId
    ) {
        return ResponseEntity.ok(executiveDashboardService.getIssueLogs(companyId));
    }

    @PostMapping("/{resource}")
    public ResponseEntity<Map<String, Object>> createRecord(
            @PathVariable String resource,
            @RequestBody Map<String, Object> payload
    ) {
        return ResponseEntity.ok(executiveDashboardService.createRecord(resource, payload));
    }

    @PutMapping("/{resource}/{id}")
    public ResponseEntity<Map<String, Object>> updateRecord(
            @PathVariable String resource,
            @PathVariable Long id,
            @RequestBody Map<String, Object> payload
    ) {
        return ResponseEntity.ok(executiveDashboardService.updateRecord(resource, id, payload));
    }

    @DeleteMapping("/{resource}/{id}")
    public ResponseEntity<Map<String, String>> deleteRecord(
            @PathVariable String resource,
            @PathVariable Long id
    ) {
        executiveDashboardService.deleteRecord(resource, id);
        return ResponseEntity.ok(Map.of("message", "삭제되었습니다."));
    }
}
