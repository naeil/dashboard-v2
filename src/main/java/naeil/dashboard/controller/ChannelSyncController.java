package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.entity.ChannelApiCredential;
import naeil.dashboard.service.ChannelSyncService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
        Boolean isActive = payload.get("isActive") instanceof Boolean
                ? (Boolean) payload.get("isActive")
                : (payload.get("isActive") != null ? Boolean.valueOf(payload.get("isActive").toString()) : null);

        // 마스킹된 값이 오면 저장하지 않음 (null 전달)
        if (key1 != null && key1.contains("****")) key1 = null;
        if (key2 != null && key2.contains("****")) key2 = null;

        channelSyncService.saveCredentials(channelType, key1, key2, null, null, isActive);
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

    // ==================== CS 문의 동기화 ====================

    @PostMapping("/sync/inquiries")
    public ResponseEntity<Map<String, Object>> syncInquiries() {
        Map<String, Object> results = channelSyncService.syncAllInquiries();
        return ResponseEntity.ok(Map.of("success", true, "results", results));
    }

}
