package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.entity.ChannelApiCredential;
import naeil.dashboard.service.ChannelSyncService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/channel-sync")
@RequiredArgsConstructor
public class ChannelSyncController {

    private final ChannelSyncService channelSyncService;

    // ==================== 자격증명 조회 ====================

    @GetMapping("/credentials")
    public ResponseEntity<List<ChannelApiCredential>> getAllCredentials() {
        List<ChannelApiCredential> creds = channelSyncService.getAllCredentials();
        // Mask sensitive keys before returning
        creds.forEach(c -> {
            if (c.getCredentialKey1() != null && c.getCredentialKey1().length() > 4) {
                c.setCredentialKey1(c.getCredentialKey1().substring(0, 4) + "****");
            }
            if (c.getCredentialKey2() != null) {
                c.setCredentialKey2("****");
            }
        });
        return ResponseEntity.ok(creds);
    }

    // ==================== 자격증명 저장 ====================

    @PutMapping("/credentials/{channelType}")
    public ResponseEntity<Map<String, Object>> saveCredentials(
            @PathVariable String channelType,
            @RequestBody Map<String, String> payload) {
        String key1 = payload.get("key1");
        String key2 = payload.get("key2");
        String key3 = payload.get("key3");
        String key4 = payload.get("key4");
        Boolean isActive = payload.containsKey("isActive") ? Boolean.parseBoolean(payload.get("isActive")) : null;

        // Don't overwrite with masked values
        if (key1 != null && key1.contains("****")) key1 = null;
        if (key2 != null && key2.contains("****")) key2 = null;

        channelSyncService.saveCredentials(channelType, key1, key2, key3, key4, isActive);
        return ResponseEntity.ok(Map.of("success", true, "message", channelType + " credentials saved"));
    }

    // ==================== 전체 동기화 ====================

    @PostMapping("/sync/all")
    public ResponseEntity<Map<String, Object>> syncAll(
            @RequestParam(required = false) String month) {
        Map<String, Object> results = channelSyncService.syncAllChannels(month);
        return ResponseEntity.ok(Map.of("success", true, "results", results));
    }

    // ==================== 채널별 동기화 ====================

    @PostMapping("/sync/{channelType}")
    public ResponseEntity<Map<String, Object>> syncChannel(
            @PathVariable String channelType,
            @RequestParam(required = false) String month) {
        Map<String, Object> result = channelSyncService.syncChannel(channelType.toUpperCase(), month);
        return ResponseEntity.ok(result);
    }
}
