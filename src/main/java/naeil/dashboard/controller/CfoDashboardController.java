package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.CfoFinanceService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * CFO 재무관리 페이지 API.
 *
 * 경로: /api/executive/cfo/**  (AuthInterceptor 에서 MANAGER 이상만 접근 가능)
 * companyId 는 클라이언트 파라미터를 신뢰하지 않고 인증된 사용자 소속 회사를 우선 사용한다.
 */
@RestController
@RequestMapping("/api/executive/cfo")
@RequiredArgsConstructor
public class CfoDashboardController {

    private final CfoFinanceService cfoFinanceService;

    private Long resolveCompanyId(HttpServletRequest request, Long fallback) {
        Object attr = request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
        if (attr instanceof AuthUser user && user.companyId() != null) {
            return user.companyId();
        }
        return fallback == null ? 1L : fallback;
    }

    private String resolveUsername(HttpServletRequest request) {
        Object attr = request.getAttribute(AuthService.AUTHENTICATED_USERNAME_ATTR);
        return attr == null ? "unknown" : String.valueOf(attr);
    }

    private LocalDate defaultFrom(LocalDate from) {
        return from != null ? from : YearMonth.now().atDay(1);
    }

    private LocalDate defaultTo(LocalDate to) {
        return to != null ? to : LocalDate.now();
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(cfoFinanceService.getSummary(
                resolveCompanyId(request, companyId), defaultFrom(from), defaultTo(to)));
    }

    @GetMapping("/profit-statement")
    public ResponseEntity<Map<String, Object>> profitStatement(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @RequestParam(required = false) String month) {
        YearMonth target = month == null ? YearMonth.now() : YearMonth.parse(month);
        return ResponseEntity.ok(cfoFinanceService.getProfitStatement(
                resolveCompanyId(request, companyId), target));
    }

    @GetMapping("/product-profitability")
    public ResponseEntity<Map<String, Object>> productProfitability(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(cfoFinanceService.getProductProfitability(
                resolveCompanyId(request, companyId), defaultFrom(from), defaultTo(to)));
    }

    @GetMapping("/channel-profitability")
    public ResponseEntity<Map<String, Object>> channelProfitability(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(cfoFinanceService.getChannelProfitability(
                resolveCompanyId(request, companyId), defaultFrom(from), defaultTo(to)));
    }

    @GetMapping("/expenses")
    public ResponseEntity<Map<String, Object>> expenses(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @RequestParam(required = false) String month) {
        YearMonth target = month == null ? YearMonth.now() : YearMonth.parse(month);
        return ResponseEntity.ok(cfoFinanceService.getExpenses(resolveCompanyId(request, companyId), target));
    }

    @GetMapping("/cashflow-forecast")
    public ResponseEntity<Map<String, Object>> cashflowForecast(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId) {
        return ResponseEntity.ok(cfoFinanceService.getCashflowForecast(resolveCompanyId(request, companyId)));
    }

    @GetMapping("/receivables-payables")
    public ResponseEntity<Map<String, Object>> receivablesPayables(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId) {
        return ResponseEntity.ok(cfoFinanceService.getReceivablesPayables(resolveCompanyId(request, companyId)));
    }

    @GetMapping("/debts")
    public ResponseEntity<Map<String, Object>> debts(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId) {
        return ResponseEntity.ok(cfoFinanceService.getDebts(resolveCompanyId(request, companyId)));
    }

    @GetMapping("/budgets")
    public ResponseEntity<List<Map<String, Object>>> budgets(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @RequestParam(required = false) String month) {
        YearMonth target = month == null ? YearMonth.now() : YearMonth.parse(month);
        return ResponseEntity.ok(cfoFinanceService.getBudgets(resolveCompanyId(request, companyId), target));
    }

    @PostMapping("/budgets")
    public ResponseEntity<Map<String, Object>> saveBudget(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @RequestBody Map<String, Object> payload) {
        YearMonth month = YearMonth.parse(String.valueOf(payload.getOrDefault("month", YearMonth.now().toString())));
        cfoFinanceService.saveBudget(
                resolveCompanyId(request, companyId), resolveUsername(request), month,
                String.valueOf(payload.getOrDefault("budgetType", "REVENUE")),
                payload.get("category") == null ? "전체" : String.valueOf(payload.get("category")),
                new BigDecimal(String.valueOf(payload.getOrDefault("amount", "0")).replace(",", "")),
                payload.get("memo") == null ? null : String.valueOf(payload.get("memo")));
        return ResponseEntity.ok(Map.of("saved", true));
    }

    @DeleteMapping("/budgets/{id}")
    public ResponseEntity<Map<String, Object>> deleteBudget(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @PathVariable Long id) {
        cfoFinanceService.deleteBudget(resolveCompanyId(request, companyId), id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    @PostMapping("/recurring-expenses")
    public ResponseEntity<Map<String, Object>> saveRecurringExpense(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @RequestBody Map<String, Object> payload) {
        cfoFinanceService.saveRecurringExpense(resolveCompanyId(request, companyId), resolveUsername(request), payload);
        return ResponseEntity.ok(Map.of("saved", true));
    }

    @DeleteMapping("/recurring-expenses/{id}")
    public ResponseEntity<Map<String, Object>> deleteRecurringExpense(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @PathVariable Long id) {
        cfoFinanceService.deleteRecurringExpense(resolveCompanyId(request, companyId), id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    @PostMapping("/fee-history")
    public ResponseEntity<Map<String, Object>> addFeeHistory(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @RequestBody Map<String, Object> payload) {
        cfoFinanceService.addFeeHistory(resolveCompanyId(request, companyId), resolveUsername(request), payload);
        return ResponseEntity.ok(Map.of("saved", true));
    }

    @GetMapping("/cost-history")
    public ResponseEntity<List<Map<String, Object>>> costHistory(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId) {
        return ResponseEntity.ok(cfoFinanceService.getCostHistory(resolveCompanyId(request, companyId)));
    }

    @PostMapping("/cost-history")
    public ResponseEntity<Map<String, Object>> addCostHistory(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @RequestBody Map<String, Object> payload) {
        cfoFinanceService.addCostHistory(resolveCompanyId(request, companyId), resolveUsername(request), payload);
        return ResponseEntity.ok(Map.of("saved", true));
    }

    @GetMapping("/alerts")
    public ResponseEntity<Map<String, Object>> alerts(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId) {
        return ResponseEntity.ok(cfoFinanceService.getAlerts(resolveCompanyId(request, companyId)));
    }

    @PatchMapping("/alerts/{id}")
    public ResponseEntity<Map<String, Object>> updateAlert(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @PathVariable Long id,
            @RequestBody Map<String, Object> payload) {
        cfoFinanceService.updateAlertStatus(
                resolveCompanyId(request, companyId), id,
                String.valueOf(payload.getOrDefault("status", "ACK")),
                payload.get("assignee") == null ? null : String.valueOf(payload.get("assignee")));
        return ResponseEntity.ok(Map.of("updated", true));
    }

    @PostMapping("/upload/{type}")
    public ResponseEntity<Map<String, Object>> uploadCsv(
            HttpServletRequest request,
            @RequestParam(required = false) Long companyId,
            @PathVariable String type,
            @RequestParam(defaultValue = "true") boolean dryRun,
            @RequestParam("file") MultipartFile file) throws Exception {
        String csvText = new String(file.getBytes(), StandardCharsets.UTF_8);
        return ResponseEntity.ok(cfoFinanceService.uploadCsv(
                resolveCompanyId(request, companyId), resolveUsername(request), type, csvText, dryRun));
    }
}
