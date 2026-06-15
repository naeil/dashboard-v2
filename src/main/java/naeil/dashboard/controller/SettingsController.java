package naeil.dashboard.controller;

import java.util.List;
import java.util.Map;
import naeil.dashboard.dto.CollectionExecutionHistoryDto;
import naeil.dashboard.dto.IntegrationSettingDto;
import naeil.dashboard.enums.IntegrationType;
import naeil.dashboard.service.IntegrationSettingService;
import naeil.dashboard.service.PlayAutoCollectionService;
import naeil.dashboard.service.ExternalIntegrationValidationService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/settings/integrations")
public class SettingsController {

    // Multi-tenant auth is not implemented yet, so a default company is used for now.
    private static final Long DEFAULT_COMPANY_ID = 1L;

    private final IntegrationSettingService settingService;
    private final PlayAutoCollectionService playAutoCollectionService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public SettingsController(
            IntegrationSettingService settingService,
            PlayAutoCollectionService playAutoCollectionService,
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper
    ) {
        this.settingService = settingService;
        this.playAutoCollectionService = playAutoCollectionService;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    // ── 메뉴 커스텀 설정 ─────────────────────────────────────────────

    @GetMapping("/menu-config")
    public ResponseEntity<Map<String, Object>> getMenuConfig() {
        try {
            String json = jdbcTemplate.queryForObject(
                "SELECT config FROM company_menu_config WHERE company_id = ?",
                String.class, DEFAULT_COMPANY_ID);
            if (json == null || json.isBlank()) return ResponseEntity.ok(Map.of());
            @SuppressWarnings("unchecked")
            Map<String, Object> config = objectMapper.readValue(json, Map.class);
            return ResponseEntity.ok(config);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of());
        }
    }

    @PutMapping("/menu-config")
    public ResponseEntity<Map<String, Object>> saveMenuConfig(@RequestBody Map<String, Object> config) {
        try {
            String json = objectMapper.writeValueAsString(config);
            jdbcTemplate.update("""
                INSERT INTO company_menu_config (company_id, config, updated_at)
                VALUES (?, ?::jsonb, NOW())
                ON CONFLICT (company_id) DO UPDATE SET config = ?::jsonb, updated_at = NOW()
                """, DEFAULT_COMPANY_ID, json, json);
            return ResponseEntity.ok(Map.of("message", "저장되었습니다."));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<IntegrationSettingDto.Response>> getSettings() {
        return ResponseEntity.ok(settingService.getSettingsByCompanyId(DEFAULT_COMPANY_ID));
    }

    @PostMapping("/validate")
    public ResponseEntity<?> validateApiKey(@RequestBody IntegrationSettingDto.ValidateRequest request) {
        ExternalIntegrationValidationService.ValidationResult result = settingService.validateApiKeyWithResult(request);
        if (result.success()) {
            return ResponseEntity.ok(Map.of("message", result.message()));
        }

        return ResponseEntity.badRequest()
                .body(Map.of("message", result.message()));
    }

    @PostMapping
    public ResponseEntity<IntegrationSettingDto.Response> saveSetting(@RequestBody IntegrationSettingDto.SaveRequest request) {
        return ResponseEntity.ok(settingService.saveSetting(DEFAULT_COMPANY_ID, request));
    }

    @PostMapping("/auth")
    public ResponseEntity<IntegrationSettingDto.Response> saveAuthSetting(@RequestBody IntegrationSettingDto.SaveAuthRequest request) {
        return ResponseEntity.ok(settingService.saveAuthSetting(DEFAULT_COMPANY_ID, request));
    }

    @PostMapping("/collection")
    public ResponseEntity<IntegrationSettingDto.Response> saveCollectionSetting(@RequestBody IntegrationSettingDto.SaveCollectionRequest request) {
        return ResponseEntity.ok(settingService.saveCollectionSetting(DEFAULT_COMPANY_ID, request));
    }

    @PostMapping("/collection/run")
    public ResponseEntity<?> runOrderCollection(@RequestBody IntegrationSettingDto.SaveCollectionRequest request) {
        settingService.saveCollectionSetting(DEFAULT_COMPANY_ID, request);
        playAutoCollectionService.runOrderCollection(DEFAULT_COMPANY_ID, false);
        return ResponseEntity.ok(Map.of("message", "Order collection completed successfully"));
    }

    @PostMapping("/shops/sync")
    public ResponseEntity<?> syncShops() {
        playAutoCollectionService.syncShopMetadata(DEFAULT_COMPANY_ID);
        return ResponseEntity.ok(Map.of("message", "Shop metadata synced successfully"));
    }

    @GetMapping("/history")
    public ResponseEntity<List<CollectionExecutionHistoryDto>> getCollectionHistory(
            @RequestParam(defaultValue = "PLAYAUTO") IntegrationType integrationType,
            @RequestParam(defaultValue = "10") Integer limit
    ) {
        return ResponseEntity.ok(settingService.getCollectionExecutionHistory(DEFAULT_COMPANY_ID, integrationType, limit));
    }

    @PostMapping("/playauto/token")
    public ResponseEntity<?> refreshPlayAutoToken() {
        String token = settingService.refreshPlayAutoToken(DEFAULT_COMPANY_ID);
        return ResponseEntity.ok(Map.of(
                "message", "PlayAuto token issued successfully",
                "accessToken", token
        ));
    }
}
