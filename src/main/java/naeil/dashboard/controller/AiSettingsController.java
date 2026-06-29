package naeil.dashboard.controller;

import java.util.List;
import java.util.Map;
import naeil.dashboard.dto.AiProviderSettingDto;
import naeil.dashboard.service.AiProviderSettingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings/ai")
public class AiSettingsController {

    private static final Long DEFAULT_COMPANY_ID = 1L;

    private final AiProviderSettingService service;

    public AiSettingsController(AiProviderSettingService service) {
        this.service = service;
    }

    @GetMapping("/providers")
    public ResponseEntity<List<AiProviderSettingDto.ProviderConfig>> getProviders() {
        return ResponseEntity.ok(service.getProviderConfigs());
    }

    @GetMapping
    public ResponseEntity<List<AiProviderSettingDto.Response>> getSettings() {
        return ResponseEntity.ok(service.getSettings(DEFAULT_COMPANY_ID));
    }

    @GetMapping("/{provider}/models")
    public ResponseEntity<List<AiProviderSettingDto.ModelOption>> getModels(@PathVariable naeil.dashboard.enums.AiProvider provider) {
        return ResponseEntity.ok(service.getModels(DEFAULT_COMPANY_ID, provider));
    }

    @PostMapping("/validate")
    public ResponseEntity<?> validate(@RequestBody AiProviderSettingDto.ValidateRequest request) {
        AiProviderSettingService.ValidationResult result = service.validate(request);
        if (result.success()) {
            return ResponseEntity.ok(Map.of("message", result.message()));
        }
        return ResponseEntity.badRequest().body(Map.of("message", result.message()));
    }

    @PostMapping
    public ResponseEntity<AiProviderSettingDto.Response> save(@RequestBody AiProviderSettingDto.SaveRequest request) {
        return ResponseEntity.ok(service.save(DEFAULT_COMPANY_ID, request));
    }
}
