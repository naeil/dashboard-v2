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

    /* ───── v2: 팀 가중치 ───── */

    @GetMapping("/teams")
    public ResponseEntity<List<Map<String, Object>>> teams() {
        return ResponseEntity.ok(kpiService.getTeams());
    }

    @PutMapping("/teams")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> saveTeams(@RequestBody Map<String, Object> payload) {
        Object rows = payload.get("rows");
        if (!(rows instanceof List<?>)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "rows 필요"));
        }
        return ResponseEntity.ok(kpiService.saveTeams((List<Map<String, Object>>) rows));
    }

    /* ───── v2: 정성 평가 ───── */

    @GetMapping("/scores")
    public ResponseEntity<List<Map<String, Object>>> scores(@RequestParam String periodKey) {
        return ResponseEntity.ok(kpiService.getScores(periodKey));
    }

    @PutMapping("/scores")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> saveScores(@RequestBody Map<String, Object> payload) {
        Object rows = payload.get("rows");
        String periodKey = payload.get("periodKey") == null ? null : String.valueOf(payload.get("periodKey"));
        if (periodKey == null || !(rows instanceof List<?>)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "periodKey·rows 필요"));
        }
        return ResponseEntity.ok(kpiService.saveScores(periodKey, (List<Map<String, Object>>) rows));
    }

    /* ───── v2: 마감·확정 워크플로우 ───── */

    @PostMapping("/close")
    public ResponseEntity<Map<String, Object>> close(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(kpiService.close(
                String.valueOf(payload.get("periodType")), String.valueOf(payload.get("anchor"))));
    }

    @PostMapping("/confirm")
    public ResponseEntity<Map<String, Object>> confirm(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(kpiService.confirm(
                String.valueOf(payload.get("periodType")), String.valueOf(payload.get("anchor")),
                payload.get("memo") == null ? null : String.valueOf(payload.get("memo"))));
    }

    @PostMapping("/reopen")
    public ResponseEntity<Map<String, Object>> reopen(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(kpiService.reopen(
                String.valueOf(payload.get("periodType")), String.valueOf(payload.get("anchor"))));
    }

    @PutMapping("/payout/{id}")
    public ResponseEntity<Map<String, Object>> adjustPayout(
            @PathVariable long id, @RequestBody Map<String, Object> payload) {
        long adjust = payload.get("adjustAmount") == null ? 0
                : Long.parseLong(String.valueOf(payload.get("adjustAmount")).replaceAll("[^0-9-]", ""));
        return ResponseEntity.ok(kpiService.adjustPayout(id, adjust,
                payload.get("reason") == null ? null : String.valueOf(payload.get("reason"))));
    }

    @GetMapping("/history")
    public ResponseEntity<Map<String, Object>> history() {
        return ResponseEntity.ok(kpiService.history());
    }
}
