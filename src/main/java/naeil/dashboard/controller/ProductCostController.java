package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.service.ProductCostService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/executive/product-costs")
@RequiredArgsConstructor
public class ProductCostController {

    private final ProductCostService productCostService;

    // ── 전체 조회 ──────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllCostData(
            @RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(productCostService.getAllCostData(companyId));
    }

    // ── 채널별 조회 ────────────────────────────────────────────────
    @GetMapping("/channel/{channelName}")
    public ResponseEntity<List<Map<String, Object>>> getChannelProducts(
            @RequestParam(defaultValue = "1") Long companyId,
            @PathVariable String channelName) {
        return ResponseEntity.ok(productCostService.getChannelProducts(companyId, channelName));
    }

    // ── 엑셀 업로드 ────────────────────────────────────────────────
    @PostMapping("/upload-excel")
    public ResponseEntity<Map<String, Object>> uploadExcel(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam("file") MultipartFile file) throws Exception {
        return ResponseEntity.ok(productCostService.uploadExcel(companyId, file));
    }

    // ── 채널 제품 원가 저장(upsert) ────────────────────────────────
    @PostMapping("/channel-product")
    public ResponseEntity<Map<String, Object>> saveChannelProduct(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(productCostService.saveChannelProduct(companyId, payload));
    }

    // ── 채널 제품 원가 수정 ────────────────────────────────────────
    @PutMapping("/channel-product/{id}")
    public ResponseEntity<Map<String, Object>> updateChannelProduct(
            @RequestParam(defaultValue = "1") Long companyId,
            @PathVariable Long id,
            @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(productCostService.updateChannelProduct(companyId, id, payload));
    }

    // ── 채널 제품 원가 삭제 ────────────────────────────────────────
    @DeleteMapping("/channel-product/{id}")
    public ResponseEntity<Map<String, String>> deleteChannelProduct(
            @RequestParam(defaultValue = "1") Long companyId,
            @PathVariable Long id) {
        productCostService.deleteChannelProduct(companyId, id);
        return ResponseEntity.ok(Map.of("message", "삭제되었습니다."));
    }

    // ── SKU 마스터 저장 ────────────────────────────────────────────
    @PostMapping("/sku")
    public ResponseEntity<Map<String, Object>> saveSku(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(productCostService.saveSku(companyId, payload));
    }

    // ── SKU 마스터 삭제 ────────────────────────────────────────────
    @PutMapping("/sku/{id}")
    public ResponseEntity<Map<String, Object>> updateSku(
            @RequestParam(defaultValue = "1") Long companyId,
            @PathVariable Long id,
            @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(productCostService.updateSku(companyId, id, payload));
    }

    @DeleteMapping("/sku/{id}")
    public ResponseEntity<Map<String, String>> deleteSku(
            @RequestParam(defaultValue = "1") Long companyId,
            @PathVariable Long id) {
        productCostService.deleteSku(companyId, id);
        return ResponseEntity.ok(Map.of("message", "삭제되었습니다."));
    }

    // ── 물류비 구간 저장 ───────────────────────────────────────────
    @PostMapping("/logistics-fee")
    public ResponseEntity<Map<String, Object>> saveLogisticsFee(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(productCostService.saveLogisticsFee(companyId, payload));
    }

    // ── 물류비 구간 삭제 ───────────────────────────────────────────
    @DeleteMapping("/logistics-fee/{id}")
    public ResponseEntity<Map<String, String>> deleteLogisticsFee(
            @RequestParam(defaultValue = "1") Long companyId,
            @PathVariable Long id) {
        productCostService.deleteLogisticsFee(companyId, id);
        return ResponseEntity.ok(Map.of("message", "삭제되었습니다."));
    }
}
