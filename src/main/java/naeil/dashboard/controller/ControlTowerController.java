package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.service.ControlTowerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 종합 상황판 — 프로젝트/재발주/개인별 업무 통합 조회 (대표·실무진 공용) */
@RestController
@RequestMapping("/api/control-tower")
@RequiredArgsConstructor
public class ControlTowerController {

    private final ControlTowerService controlTowerService;

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> overview(
            @RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(controlTowerService.getOverview(companyId));
    }

    @PostMapping("/task")
    public ResponseEntity<Map<String, Object>> createTask(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(controlTowerService.createTask(companyId, payload));
    }

    @PutMapping("/task/{id}")
    public ResponseEntity<Map<String, Object>> updateTask(
            @RequestParam(defaultValue = "1") Long companyId,
            @PathVariable long id,
            @RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(controlTowerService.updateTask(companyId, id, payload));
    }

    @PutMapping("/lead-days")
    public ResponseEntity<Map<String, Object>> saveLeadDays(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> payload) {
        long productId = Long.parseLong(String.valueOf(payload.get("productId")));
        int days = (int) Double.parseDouble(String.valueOf(payload.getOrDefault("days", 14)));
        return ResponseEntity.ok(controlTowerService.saveLeadDays(companyId, productId, days));
    }
}
