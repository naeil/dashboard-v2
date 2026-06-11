package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.service.AdApiCredentialService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ad-credentials")
@RequiredArgsConstructor
public class AdApiCredentialController {
    private final AdApiCredentialService service;

    @GetMapping
    public ResponseEntity<Map<String, Map<String, String>>> get(@RequestParam Long companyId) {
        return ResponseEntity.ok(service.findByCompany(companyId));
    }

    @PostMapping("/{platform}")
    public ResponseEntity<Void> save(
            @PathVariable String platform,
            @RequestParam Long companyId,
            @RequestBody Map<String, String> keys) {
        service.upsertPlatform(companyId, platform, keys);
        return ResponseEntity.ok().build();
    }
}
