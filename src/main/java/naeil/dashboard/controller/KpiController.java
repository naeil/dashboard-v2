package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.service.KpiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** KPI·성과급 — 팀/개인 × 월·분기·반기·연 성과와 반기 성과급 배분 */
@RestController
@RequestMapping("/api/kpi")
@RequiredArgsConstructor
public class KpiController {

    private final KpiService kpiService;

    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> config() {
        return ResponseEntity.ok(kpiService.getConfig());
    }

    @PutMapping("/config")
    public ResponseEntity<Map<String, Object>> saveConfig(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(kpiService.saveConfig(payload));
    }

    @GetMapping("/assignments")
    public ResponseEntity<List<Map<String, Object>>> assignments() {
        return ResponseEntity.ok(kpiService.getAssignments());
    }

    @PutMapping("/assignments")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> saveAssignments(@RequestBody Map<String, Object> payload) {
        Object rows = payload.get("rows");
        if (!(rows instanceof List<?>)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "rows 필요"));
        }
        return ResponseEntity.ok(kpiService.saveAssignments((List<Map<String, Object>>) rows));
    }

    @GetMapping("/targets")
    public ResponseEntity<List<Map<String, Object>>> targets(
            @RequestParam String fromMonth, @RequestParam String toMonth) {
        return ResponseEntity.ok(kpiService.getTargets(fromMonth, toMonth));
    }

    @PutMapping("/targets")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> saveTargets(@RequestBody Map<String, Object> payload) {
        Object rows = payload.get("rows");
        if (!(rows instanceof List<?>)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "rows 필요"));
        }
        return ResponseEntity.ok(kpiService.saveTargets((List<Map<String, Object>>) rows));
    }

    @GetMapping("/performance")
    public ResponseEntity<Map<String, Object>> performance(
            @RequestParam(defaultValue = "month") String periodType,
            @RequestParam(required = false) String anchor) {
        return ResponseEntity.ok(kpiService.getPerformance(periodType,
                anchor == null ? java.time.YearMonth.now().toString() : anchor));
    }
}
