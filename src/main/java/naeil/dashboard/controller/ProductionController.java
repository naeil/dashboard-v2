package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.ProductionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** 생산 관리 — 발주/입고/원가 추적 (대표·실무진 공용) */
@RestController
@RequestMapping("/api/production")
@RequiredArgsConstructor
public class ProductionController {

    private final ProductionService productionService;

    @GetMapping("/suppliers")
    public ResponseEntity<List<Map<String, Object>>> suppliers(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(productionService.getSuppliers(companyId));
    }

    @PostMapping("/suppliers")
    public ResponseEntity<Map<String, Object>> saveSupplier(
            @RequestParam(defaultValue = "1") Long companyId, @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(productionService.saveSupplier(companyId, payload));
    }

    @GetMapping("/orders")
    public ResponseEntity<List<Map<String, Object>>> orders(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(productionService.getOrders(companyId, status));
    }

    @GetMapping("/orders/{id}/items")
    public ResponseEntity<List<Map<String, Object>>> orderItems(
            @RequestParam(defaultValue = "1") Long companyId, @PathVariable long id) {
        return ResponseEntity.ok(productionService.getOrderItems(companyId, id));
    }

    @PostMapping("/orders")
    public ResponseEntity<Map<String, Object>> createOrder(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request) {
        AuthUser user = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
        return ResponseEntity.ok(productionService.createOrder(companyId, payload,
                user == null ? null : user.displayName()));
    }

    @PostMapping("/orders/{id}/receive")
    public ResponseEntity<Map<String, Object>> receiveOrder(
            @RequestParam(defaultValue = "1") Long companyId,
            @PathVariable long id,
            @RequestBody(required = false) Map<String, Object> payload) {
        String receivedDate = payload == null || payload.get("receivedDate") == null
                ? null : String.valueOf(payload.get("receivedDate"));
        return ResponseEntity.ok(productionService.receiveOrder(companyId, id, receivedDate));
    }

    @PostMapping("/orders/{id}/cancel")
    public ResponseEntity<Map<String, Object>> cancelOrder(
            @RequestParam(defaultValue = "1") Long companyId, @PathVariable long id) {
        return ResponseEntity.ok(productionService.cancelOrder(companyId, id));
    }

    @GetMapping("/cost-trend")
    public ResponseEntity<Map<String, Object>> costTrend(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(productionService.getCostTrend(companyId));
    }

    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> config(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(productionService.getConfig(companyId));
    }

    @PutMapping("/config")
    public ResponseEntity<Map<String, Object>> saveConfig(
            @RequestParam(defaultValue = "1") Long companyId, @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(productionService.saveConfig(companyId, payload));
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(productionService.getSummary(companyId));
    }
}
