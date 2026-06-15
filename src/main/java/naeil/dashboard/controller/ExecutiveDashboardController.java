package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.ExecutiveDashboardService;
import naeil.dashboard.service.IssueBriefingService;
import naeil.dashboard.service.PlayAutoCollectionService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


public class ExecutiveDashboardController {

    private final ExecutiveDashboardService executiveDashboardService;
    private final PlayAutoCollectionService playAutoCollectionService;
    private final IssueBriefingService issueBriefingService;

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getSummary(companyId));
    }

    @GetMapping("/monthly-sales")
    public ResponseEntity<List<Map<String, Object>>> getMonthlySales(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getMonthlySales(companyId));
    }

    @GetMapping("/cash-flow")
    public ResponseEntity<Map<String, Object>> getCashFlow(@RequestParam(defaultValue = "1") Long companyId) {
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
    public ResponseEntity<List<Map<String, Object>>> getProductProfits(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getProductProfits(companyId));
    }

    @GetMapping("/product-movements")
    public ResponseEntity<Map<String, Object>> getProductMovements(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getProductMovements(companyId));
    }

    @PostMapping("/product-movements/sync-playauto")
    public ResponseEntity<Map<String, Object>> syncPlayAutoProductMovements(@RequestParam(defaultValue = "1") Long companyId) {
        playAutoCollectionService.runInventoryCollection(companyId, false);
        Map<String, Object> result = new LinkedHashMap<>(executiveDashboardService.getProductMovements(companyId));
        result.put("message", "PlayAuto inventory and outbound data synced.");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/product-forecasts")
    public ResponseEntity<List<Map<String, Object>>> getProductForecasts(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getProductForecasts(companyId));
    }

    @GetMapping("/work-tasks")
    public ResponseEntity<List<Map<String, Object>>> getWorkTasks(
            @RequestParam(defaultValue = "1") Long companyId,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(executiveDashboardService.getWorkTasks(companyId, requireUser(request)));
    }

    @GetMapping("/channel-credentials")
    public ResponseEntity<List<Map<String, Object>>> getChannelCredentials(
            @RequestParam(defaultValue = "1") Long companyId,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(executiveDashboardService.getChannelCredentials(companyId, requireUser(request)));
    }

    @PostMapping("/channel-credentials")
    public ResponseEntity<Map<String, Object>> saveChannelCredential(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(executiveDashboardService.saveChannelCredential(companyId, payload, requireUser(request)));
    }

    @GetMapping("/payment-requests")
    public ResponseEntity<List<Map<String, Object>>> getPaymentRequests(
            @RequestParam(defaultValue = "1") Long companyId,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(executiveDashboardService.getPaymentRequests(companyId, requireUser(request)));
    }

    @PostMapping("/payment-requests/{id}/approve")
    public ResponseEntity<Map<String, Object>> approvePaymentRequest(@PathVariable Long id) {
        return ResponseEntity.ok(executiveDashboardService.approvePaymentRequest(id));
    }

    @GetMapping("/customer-inquiries")
    public ResponseEntity<Map<String, Object>> getCustomerInquiries(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getCustomerInquiries(companyId));
    }

    @GetMapping("/customer-db")
    public ResponseEntity<Map<String, Object>> getCustomerDatabase(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            HttpServletRequest request
    ) {
        requireExecutive(request);
        return ResponseEntity.ok(executiveDashboardService.getCustomerDatabase(companyId, startDate, endDate));
    }

    @PostMapping("/customer-db/sync-playauto")
    public ResponseEntity<Map<String, Object>> syncPlayAutoCustomerDatabase(
            @RequestParam(defaultValue = "1") Long companyId,
            HttpServletRequest request
    ) {
        requireExecutive(request);
        playAutoCollectionService.runOrderCollection(companyId, false);
        Map<String, Object> result = new LinkedHashMap<>(executiveDashboardService.getCustomerDatabase(companyId, null, null));
        result.put("message", "PlayAuto 고객 주문 데이터 수집이 완료되었습니다.");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/ceo-dashboard")
    public ResponseEntity<Map<String, Object>> getCeoDashboard(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getCeoDashboard(companyId));
    }

    @GetMapping("/ceo-financials")
    public ResponseEntity<Map<String, Object>> getCeoFinancials(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getCeoFinancials(companyId));
    }

    @PostMapping("/ceo-financials")
    public ResponseEntity<Map<String, Object>> saveCeoFinancials(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> payload
    ) {
        return ResponseEntity.ok(executiveDashboardService.saveCeoFinancials(companyId, payload));
    }

    // 이하 기존 핸들러들은 원본 유지 필요 - 아래는 나머지 엔드포인트들
    @GetMapping("/issues")
    public ResponseEntity<List<Map<String, Object>>> getIssueLogs(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getIssueLogs(companyId));
    }

    @GetMapping("/issue-briefing")
    public ResponseEntity<Map<String, Object>> getIssueBriefing(
            @RequestParam(defaultValue = "1") Long companyId,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(issueBriefingService.getIssueBriefing(companyId, requireUser(request)));
    }

    @GetMapping("/ad-performance")
    public ResponseEntity<List<Map<String, Object>>> getAdPerformance(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getAdPerformance(companyId));
    }

    @GetMapping("/ad-roas-goals")
    public ResponseEntity<List<Map<String, Object>>> getAdRoasGoals(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getAdRoasGoals(companyId));
    }

    @GetMapping("/channel-sales")
    public ResponseEntity<Map<String, Object>> getChannelSales(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getChannelSales(companyId));
    }

    @GetMapping("/channel-sales/analytics")
    public ResponseEntity<Map<String, Object>> getChannelSalesAnalytics(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String shopName
    ) {
        return ResponseEntity.ok(executiveDashboardService.getChannelSalesAnalytics(companyId, startDate, endDate, shopName));
    }

    @PostMapping("/channel-sales/import-playauto")
    public ResponseEntity<Map<String, Object>> importPlayAutoChannelSales(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(defaultValue = "true") boolean refreshOrders,
            HttpServletRequest request
    ) {
        requireExecutive(request);
        return ResponseEntity.ok(executiveDashboardService.importPlayAutoChannelSales(companyId, refreshOrders));
    }

    @GetMapping("/receivables")
    public ResponseEntity<Map<String, Object>> getReceivables(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getReceivables(companyId));
    }

    @GetMapping("/partners")
    public ResponseEntity<List<Map<String, Object>>> getPartners(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getPartners(companyId));
    }

    @GetMapping("/operating-expenses")
    public ResponseEntity<Map<String, Object>> getOperatingExpenses(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getOperatingExpenses(companyId));
    }

    @GetMapping("/debts")
    public ResponseEntity<Map<String, Object>> getDebts(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getDebts(companyId));
    }

    @GetMapping("/export-pipeline")
    public ResponseEntity<Map<String, Object>> getExportPipeline(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getExportPipeline(companyId));
    }

    @GetMapping("/export-supply-prices")
    public ResponseEntity<List<Map<String, Object>>> getExportSupplyPrices(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getExportSupplyPrices(companyId));
    }

    @GetMapping("/brand-health")
    public ResponseEntity<Map<String, Object>> getBrandHealth(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return ResponseEntity.ok(executiveDashboardService.getBrandHealth(companyId, startDate, endDate));
    }

    @GetMapping("/profit-management")
    public ResponseEntity<Map<String, Object>> getProfitManagement(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) String planMonth
    ) {
        return ResponseEntity.ok(executiveDashboardService.getProfitManagement(companyId, planMonth));
    }

    @PostMapping("/profit-management/plan")
    public ResponseEntity<Map<String, Object>> saveProfitPlan(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam String planMonth,
            @RequestBody List<Map<String, Object>> items
    ) {
        return ResponseEntity.ok(executiveDashboardService.saveProfitPlan(companyId, planMonth, items));
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
    public ResponseEntity<Map<String, Object>> deleteRecord(
            @PathVariable String resource,
            @PathVariable Long id,
            HttpServletRequest request
    ) {
        requireExecutive(request);
        return ResponseEntity.ok(executiveDashboardService.deleteRecord(resource, id));
    }

    private AuthUser requireUser(HttpServletRequest request) {
        AuthUser user = (AuthUser) request.getAttribute("user");
        if (user == null) throw new CustomException("인증이 필요합니다.", 401);
        return user;
    }

    private void requireExecutive(HttpServletRequest request) {
        AuthUser user = requireUser(request);
        if (user.getRole() != UserRole.EXECUTIVE && user.getRole() != UserRole.MANAGER) {
            throw new CustomException("임원/관리자만 접근 가능합니다.", 403);
        }
    }
    }
