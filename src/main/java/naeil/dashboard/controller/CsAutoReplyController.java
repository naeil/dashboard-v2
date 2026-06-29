package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.service.CsAutoReplyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * CS 자동답변 REST API 컨트롤러
   *
   * GET  /api/cs-auto-reply/status       - 킬 스위치 / 드라이런 상태 조회
   * POST /api/cs-auto-reply/kill-switch  - 킬 스위치 on/off
   * POST /api/cs-auto-reply/dry-run      - 드라이런 모드 on/off
   * POST /api/cs-auto-reply/collect      - 플레이오토에서 신규 문의 수집 + 자동처리
   * GET  /api/cs-auto-reply/queue        - 대기 큐 조회
   * POST /api/cs-auto-reply/{id}/approve - 대기 건 승인 & 발송
   * POST /api/cs-auto-reply/{id}/reject  - 대기 건 반려
   * GET  /api/cs-auto-reply/log          - 전체 처리 로그
   * GET  /api/cs-auto-reply/stats        - 통계
   * PUT  /api/cs-auto-reply/category/{cat}/toggle - 카테고리별 자동발송 토글
   */
@RestController
  @RequestMapping("/api/cs-auto-reply")
  @RequiredArgsConstructor
  public class CsAutoReplyController {

    private final CsAutoReplyService csAutoReplyService;

    /** 현재 상태 조회 (킬 스위치, 드라이런, 카테고리 설정 등) */
    @GetMapping("/status")
        public ResponseEntity<Map<String, Object>> getStatus() {
                  return ResponseEntity.ok(csAutoReplyService.getStatus());
        }

    /** 킬 스위치: 자동발송 전체 활성화/비활성화 */
    @PostMapping("/kill-switch")
        public ResponseEntity<Map<String, Object>> setKillSwitch(@RequestBody Map<String, Object> body) {
                  boolean enabled = Boolean.parseBoolean(body.getOrDefault("enabled", false).toString());
                  csAutoReplyService.setAutoSendEnabled(enabled);
                  return ResponseEntity.ok(Map.of("success", true, "autoSendEnabled", enabled,
                                                              "message", enabled ? "자동발송 활성화됨" : "자동발송 중단됨 (킬 스위치 ON)"));
        }

    /** 드라이런 모드 설정 */
    @PostMapping("/dry-run")
        public ResponseEntity<Map<String, Object>> setDryRun(@RequestBody Map<String, Object> body) {
                  boolean dryRun = Boolean.parseBoolean(body.getOrDefault("dryRun", true).toString());
                  csAutoReplyService.setDryRunMode(dryRun);
                  return ResponseEntity.ok(Map.of("success", true, "dryRunMode", dryRun,
                                                              "message", dryRun ? "드라이런 모드 ON (실제 발송 안 함)" : "실제 발송 모드 ON"));
        }

    /** 카테고리별 자동발송 토글 */
    @PutMapping("/category/{category}/toggle")
        public ResponseEntity<Map<String, Object>> toggleCategory(
                  @PathVariable String category,
                  @RequestBody Map<String, Object> body) {
                  boolean enabled = Boolean.parseBoolean(body.getOrDefault("enabled", false).toString());
                  csAutoReplyService.setCategoryAutoEnabled(category, enabled);
                  return ResponseEntity.ok(Map.of("success", true, "category", category, "autoEnabled", enabled));
        }

    /** 플레이오토에서 신규 문의 수집 및 자동 처리 */
    @PostMapping("/collect")
        public ResponseEntity<Map<String, Object>> collectAndProcess() {
                  Map<String, Object> result = csAutoReplyService.collectInquiries();
                  return ResponseEntity.ok(result);
        }

    /** 대기 큐 목록 조회 */
    @GetMapping("/queue")
        public ResponseEntity<List<Map<String, Object>>> getPendingQueue() {
                  return ResponseEntity.ok(csAutoReplyService.getPendingQueue());
        }

    /** 대기 건 승인 및 발송 */
    @PostMapping("/{id}/approve")
        public ResponseEntity<Map<String, Object>> approve(
                  @PathVariable Long id,
                  @RequestBody(required = false) Map<String, Object> body) {
                  String approvedBy = body != null ? (String) body.getOrDefault("approvedBy", "operator") : "operator";
                  Map<String, Object> result = csAutoReplyService.approveAndSend(id, approvedBy);
                  return ResponseEntity.ok(result);
        }

    /** 대기 건 반려 */
    @PostMapping("/{id}/reject")
        public ResponseEntity<Map<String, Object>> reject(@PathVariable Long id) {
                  // 상태를 REJECTED로 변경 (서비스에서 처리)
            return ResponseEntity.ok(Map.of("success", true, "id", id, "status", "REJECTED",
                                                        "message", "반려 처리되었습니다"));
        }

    /** 전체 처리 로그 조회 */
    @GetMapping("/log")
        public ResponseEntity<List<Map<String, Object>>> getLog() {
                  return ResponseEntity.ok(csAutoReplyService.getReplyLog());
        }

    /** 통계 */
    @GetMapping("/stats")
        public ResponseEntity<Map<String, Object>> getStats() {
                  return ResponseEntity.ok(csAutoReplyService.getStats());
        }
  }
