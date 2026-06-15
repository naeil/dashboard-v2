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

@RestController
@RequestMapping("/api/executive")
@RequiredArgsConstructor
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

    @GetMapping("/channel-sales")
    public ResponseEntity<List<Map<String, Object>>> getChannelSales(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getChannelSales(companyId));
    }

    @GetMapping("/consulting-revenues")
    public ResponseEntity<List<Map<String, Object>>> getConsultingRevenues(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getConsultingRevenues(companyId));
    }

    @GetMapping("/channel-sales/analytics")
    public ResponseEntity<Map<String, Object>> getChannelSalesAnalytics(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long brandId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String productGroup,
            @RequestParam(required = false) String channel
    ) {
        return ResponseEntity.ok(executiveDashboardService.getChannelSalesAnalytics(companyId, startDate, endDate, brandId, search, productGroup, channel));
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
    public ResponseEntity<List<Map<String, Object>>> getReceivables(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getReceivables(companyId));
    }

    @GetMapping("/partners")
    public ResponseEntity<List<Map<String, Object>>> getPartners(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getPartners(companyId));
    }

    @GetMapping("/operating-expenses")
    public ResponseEntity<List<Map<String, Object>>> getOperatingExpenses(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getOperatingExpenses(companyId));
    }

    @GetMapping("/debts")
    public ResponseEntity<List<Map<String, Object>>> getDebts(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getDebts(companyId));
    }

    @GetMapping("/export-pipeline")
    public ResponseEntity<List<Map<String, Object>>> getExportPipeline(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getExportPipeline(companyId));
    }

    @GetMapping("/export-supply-prices")
    public ResponseEntity<List<Map<String, Object>>> getExportSupplyPrices(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getExportSupplyPrices(companyId));
    }

    @GetMapping("/ad-performance")
    public ResponseEntity<List<Map<String, Object>>> getAdPerformance(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getAdPerformance(companyId));
    }

    @GetMapping("/ad-roas-goals")
    public ResponseEntity<List<Map<String, Object>>> getAdRoasGoals(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getAdRoasGoals(companyId));
    }

    @GetMapping("/issues")
    public ResponseEntity<List<Map<String, Object>>> getIssueLogs(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(executiveDashboardService.getIssueLogs(companyId));
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
        requireManagerOrExecutive(requireUser(request));
        return ResponseEntity.ok(executiveDashboardService.getCustomerDatabase(companyId, startDate, endDate));
    }

    @PostMapping("/customer-db/sync-playauto")
    public ResponseEntity<Map<String, Object>> syncPlayAutoCustomerDatabase(
            @RequestParam(defaultValue = "1") Long companyId,
            HttpServletRequest request
    ) {
        requireManagerOrExecutive(requireUser(request));
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

    /** 임시 진단 엔드포인트 - 쿠팡 pay_amt 값 확인용 */
    @GetMapping("/diag/channel-orders")
    public ResponseEntity<Map<String, Object>> diagnoseChannelOrders(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String shopName
    ) {
        return ResponseEntity.ok(executiveDashboardService.diagnoseChannelOrders(companyId, startDate, endDate, shopName));
    }

    @GetMapping("/brand-health")
    public ResponseEntity<Map<String, Object>> getBrandHealth(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) Long brandId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return ResponseEntity.ok(executiveDashboardService.getBrandHealth(companyId, brandId, startDate, endDate));
    }

    @GetMapping("/issue-briefing")
    public ResponseEntity<Map<String, Object>> getIssueBriefing() {
        return ResponseEntity.ok(issueBriefingService.getIssueBriefing());
    }

    @GetMapping("/profit-management")
    public ResponseEntity<Map<String, Object>> getProfitManagement(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate planMonth
    ) {
        return ResponseEntity.ok(executiveDashboardService.getProfitManagement(companyId, planMonth));
    }

    @PostMapping("/profit-management/plan")
    public ResponseEntity<Map<String, String>> saveProfitPlan(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate planMonth,
            @RequestBody List<Map<String, Object>> items
    ) {
        executiveDashboardService.saveProfitPlan(companyId, planMonth, items);
        return ResponseEntity.ok(Map.of("message", "저장되었습니다."));
    }

    @PostMapping("/{resource}")
    public ResponseEntity<Map<String, Object>> createRecord(
            @PathVariable String resource,
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(executiveDashboardService.createRecord(resource, payload, requireUser(request)));
    }

    @PutMapping("/{resource}/{id}")
    public ResponseEntity<Map<String, Object>> updateRecord(
            @PathVariable String resource,
            @PathVariable Long id,
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request
    ) {
        return ResponseEntity.ok(executiveDashboardService.updateRecord(resource, id, payload, requireUser(request)));
    }

    @DeleteMapping("/{resource}/{id}")
    public ResponseEntity<Map<String, String>> deleteRecord(
            @PathVariable String resource,
            @PathVariable Long id,
            HttpServletRequest request
    ) {
        executiveDashboardService.deleteRecord(resource, id, requireUser(request));
        return ResponseEntity.ok(Map.of("message", "삭제되었습니다."));
    }

    private AuthUser requireUser(HttpServletRequest request) {
        return (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
    }

    private void requireManagerOrExecutive(AuthUser user) {
        if (user == null) {
            throw new CustomException(401, "로그인이 필요합니다.");
        }
        UserRole role = UserRole.from(user.role());
        if (role != UserRole.EXECUTIVE && role != UserRole.MANAGER) {
            throw new CustomException(403, "관리자 권한이 필요한 고객 DB입니다.");
        }
    }
}
