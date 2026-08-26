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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    // ── 로그인 화면 브랜딩 (GET은 비로그인 허용 — AuthInterceptor 화이트리스트) ──

    @GetMapping("/login-branding")
    public ResponseEntity<Map<String, Object>> getLoginBranding() {
        try {
            String image = jdbcTemplate.queryForObject(
                "SELECT login_image FROM company_branding WHERE company_id = ?",
                String.class, DEFAULT_COMPANY_ID);
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("image", image);
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("image", null);
            return ResponseEntity.ok(body);
        }
    }

    @PutMapping("/login-branding")
    public ResponseEntity<Map<String, Object>> saveLoginBranding(@RequestBody Map<String, Object> payload) {
        Object imageObj = payload.get("image");
        String image = imageObj == null ? null : String.valueOf(imageObj);
        if (image != null && image.isBlank()) image = null;
        if (image != null && !image.startsWith("data:image/")) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "이미지 형식이 아닙니다."));
        }
        if (image != null && image.length() > 4_000_000) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "이미지가 너무 큽니다 (최대 약 3MB)."));
        }
        jdbcTemplate.update("""
            INSERT INTO company_branding (company_id, login_image, updated_at)
            VALUES (?, ?, NOW())
            ON CONFLICT (company_id) DO UPDATE SET login_image = EXCLUDED.login_image, updated_at = NOW()
            """, DEFAULT_COMPANY_ID, image);
        return ResponseEntity.ok(Map.of("success", true));
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
        ExternalIntegrationValidationService.ValidationResult result = settingService.validateApiKeyWithResult(DEFAULT_COMPANY_ID, request);
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

    @DeleteMapping("/{integrationType}/auth")
    public ResponseEntity<IntegrationSettingDto.Response> clearAuthSetting(@PathVariable IntegrationType integrationType) {
        return ResponseEntity.ok(settingService.clearAuthSetting(DEFAULT_COMPANY_ID, integrationType));
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
