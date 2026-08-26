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
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("image", null);
        body.put("title", null);
        body.put("subtitle", null);
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT login_image, login_title, login_subtitle FROM company_branding WHERE company_id = ?",
                DEFAULT_COMPANY_ID);
            body.put("image", row.get("login_image"));
            body.put("title", row.get("login_title"));
            body.put("subtitle", row.get("login_subtitle"));
        } catch (Exception ignored) {
            // 행이 없으면 기본값(null) 유지
        }
        return ResponseEntity.ok(body);
    }

    @PutMapping("/login-branding")
    public ResponseEntity<Map<String, Object>> saveLoginBranding(@RequestBody Map<String, Object> payload) {
        // 이미지·문구 각각 독립 저장: payload에 키가 있을 때만 해당 컬럼을 갱신
        boolean hasImage = payload.containsKey("image");
        boolean hasTitle = payload.containsKey("title");
        boolean hasSubtitle = payload.containsKey("subtitle");
        if (!hasImage && !hasTitle && !hasSubtitle) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "저장할 값이 없습니다."));
        }

        String image = blankToNull(payload.get("image"));
        if (hasImage && image != null && !image.startsWith("data:image/")) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "이미지 형식이 아닙니다."));
        }
        if (hasImage && image != null && image.length() > 4_000_000) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "이미지가 너무 큽니다 (최대 약 3MB)."));
        }

        String title = blankToNull(payload.get("title"));
        if (hasTitle && title != null && title.length() > 80) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "헤드라인은 80자 이내로 입력하세요."));
        }
        String subtitle = blankToNull(payload.get("subtitle"));
        if (hasSubtitle && subtitle != null && subtitle.length() > 160) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "설명 문구는 160자 이내로 입력하세요."));
        }

        jdbcTemplate.update("INSERT INTO company_branding (company_id) VALUES (?) ON CONFLICT (company_id) DO NOTHING",
                DEFAULT_COMPANY_ID);
        if (hasImage) {
            jdbcTemplate.update("UPDATE company_branding SET login_image = ?, updated_at = NOW() WHERE company_id = ?",
                    image, DEFAULT_COMPANY_ID);
        }
        if (hasTitle) {
            jdbcTemplate.update("UPDATE company_branding SET login_title = ?, updated_at = NOW() WHERE company_id = ?",
                    title, DEFAULT_COMPANY_ID);
        }
        if (hasSubtitle) {
            jdbcTemplate.update("UPDATE company_branding SET login_subtitle = ?, updated_at = NOW() WHERE company_id = ?",
                    subtitle, DEFAULT_COMPANY_ID);
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    private static String blankToNull(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value);
        return text.isBlank() ? null : text;
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
