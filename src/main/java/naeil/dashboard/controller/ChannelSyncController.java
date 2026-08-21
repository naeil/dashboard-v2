package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.entity.ChannelApiCredential;
import naeil.dashboard.service.ChannelSyncService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/channel-sync")
@RequiredArgsConstructor
public class ChannelSyncController {

    private final ChannelSyncService channelSyncService;

    // ==================== 자격증명 조회 (마스킹) ====================

    @GetMapping("/credentials")
    public ResponseEntity<List<Map<String, Object>>> getAllCredentials() {
        List<ChannelApiCredential> creds = channelSyncService.getAllCredentials();
        List<Map<String, Object>> result = creds.stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("channelType", c.getChannelType());
            // key1: null이면 null, 있으면 앞 4자만 + ****
            m.put("credentialKey1", maskKey(c.getCredentialKey1()));
            // key2: 있으면 **** 없으면 null
            m.put("credentialKey2", c.getCredentialKey2() != null ? "****" : null);
            // key3: 비밀값 아님 (쿠팡 Vendor ID 등) — 평문 노출
            m.put("credentialKey3", c.getCredentialKey3());
            m.put("isActive", c.getIsActive());
            m.put("lastSyncAt", c.getLastSyncAt());
            m.put("lastSyncStatus", c.getLastSyncStatus());
            m.put("lastSyncMessage", c.getLastSyncMessage());
            m.put("hasKey1", c.getCredentialKey1() != null && !c.getCredentialKey1().isBlank());
            m.put("hasKey2", c.getCredentialKey2() != null && !c.getCredentialKey2().isBlank());
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    private String maskKey(String key) {
        if (key == null || key.isBlank()) return null;
        if (key.length() <= 4) return "****";
        return key.substring(0, 4) + "****";
    }

    // ==================== 자격증명 저장 ====================

    @PutMapping("/credentials/{channelType}")
    public ResponseEntity<Map<String, Object>> saveCredentials(
            @PathVariable String channelType,
            @RequestBody Map<String, Object> payload) {
        String key1 = (String) payload.get("key1");
        String key2 = (String) payload.get("key2");
        String key3 = (String) payload.get("key3");
        Boolean isActive = payload.get("isActive") instanceof Boolean
                ? (Boolean) payload.get("isActive")
                : (payload.get("isActive") != null ? Boolean.valueOf(payload.get("isActive").toString()) : null);

        // 마스킹된 값이 오면 저장하지 않음 (null 전달)
        if (key1 != null && key1.contains("****")) key1 = null;
        if (key2 != null && key2.contains("****")) key2 = null;
        if (key3 != null && key3.contains("****")) key3 = null;

        channelSyncService.saveCredentials(channelType, key1, key2, key3, null, isActive);
        return ResponseEntity.ok(Map.of("success", true, "message", channelType + " credentials saved"));
    }

    // ==================== 전체 동기화 ====================

    @PostMapping("/sync/all")
    public ResponseEntity<Map<String, Object>> syncAll(
            @RequestParam(required = false) String month) {
        Map<String, Object> results = channelSyncService.syncAllChannels(month);
        boolean anySuccess = results.values().stream()
                .anyMatch(v -> v instanceof Map && Boolean.TRUE.equals(((Map<?, ?>) v).get("success")));
        return ResponseEntity.ok(Map.of("success", true, "results", results, "anySuccess", anySuccess));
    }

    // ==================== 채널별 동기화 ====================

    @PostMapping("/sync/{channelType}")
    public ResponseEntity<Map<String, Object>> syncChannel(
            @PathVariable String channelType,
            @RequestParam(required = false) String month) {
        Map<String, Object> result = channelSyncService.syncChannel(channelType.toUpperCase(), month);
        return ResponseEntity.ok(result);
    }

    // ==================== 일별 매출 수집 (field_sales_entry → CFO/CEO 대시보드) ====================

    @PostMapping("/sync-daily/all")
    public ResponseEntity<Map<String, Object>> syncDailyAll(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate[] range = resolveDailyRange(from, to);
        if (range == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "기간이 잘못되었습니다 (최대 62일, from ≤ to)"));
        }
        Map<String, Object> results = channelSyncService.syncDailyAll(range[0], range[1]);
        return ResponseEntity.ok(Map.of("success", true, "from", range[0].toString(), "to", range[1].toString(), "results", results));
    }

    @PostMapping("/sync-daily/{channelType}")
    public ResponseEntity<Map<String, Object>> syncDailyChannel(
            @PathVariable String channelType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate[] range = resolveDailyRange(from, to);
        if (range == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "기간이 잘못되었습니다 (최대 62일, from ≤ to)"));
        }
        Map<String, Object> result = channelSyncService.syncDailyChannel(channelType.toUpperCase(), range[0], range[1]);
        return ResponseEntity.ok(result);
    }

    private LocalDate[] resolveDailyRange(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        LocalDate end = to != null ? to : today;
        LocalDate start = from != null ? from : end.minusDays(1);
        if (start.isAfter(end)) return null;
        if (ChronoUnit.DAYS.between(start, end) > 62) return null;
        return new LocalDate[]{start, end};
    }

    // ==================== CS 문의 동기화 ====================

    @PostMapping("/sync/inquiries")
    public ResponseEntity<Map<String, Object>> syncInquiries() {
        Map<String, Object> results = channelSyncService.syncAllInquiries();
        return ResponseEntity.ok(Map.of("success", true, "results", results));
    }

    // ==================== CS 문의 답변 등록 ====================

    @PostMapping("/inquiries/{inquiryId}/answer")
    public ResponseEntity<Map<String, Object>> answerInquiry(
            @PathVariable Long inquiryId,
            @RequestBody Map<String, Object> payload) {
        try {
            String content = (String) payload.get("content");
            if (content == null || content.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "답변 내용을 입력해주세요."));
            }
            Map<String, Object> result = channelSyncService.answerInquiry(inquiryId, content);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

}
