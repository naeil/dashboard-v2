package naeil.dashboard.controller;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.entity.SiteLoginBanner;
import naeil.dashboard.service.SiteLoginBannerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Login-page banner image REST API.
 * GET /api/public/login-banner is unauthenticated so the login page can
 * render the current banner before the user signs in. The update endpoint
 * requires an authenticated session and is used from the platform admin
 * console. Additive-only controller: does not modify any existing endpoint.
 */
@RestController
@RequiredArgsConstructor
public class SiteLoginBannerController {

    private final SiteLoginBannerService siteLoginBannerService;

    @GetMapping("/api/public/login-banner")
    public ResponseEntity<Map<String, Object>> getPublicBanner(
        @RequestParam(defaultValue = "1") Long companyId) {
        SiteLoginBanner banner = siteLoginBannerService.getBanner(companyId);
        return ResponseEntity.ok(Map.of(
            "imageData", banner != null && banner.getImageData() != null ? banner.getImageData() : "",
            "updatedAt", banner != null && banner.getUpdatedAt() != null ? banner.getUpdatedAt().toString() : ""
        ));
    }

    @PutMapping("/api/login-banner")
    public ResponseEntity<SiteLoginBanner> updateBanner(
        @RequestParam(defaultValue = "1") Long companyId,
        @RequestParam(required = false) String updatedBy,
        @RequestBody Map<String, String> payload) {
        SiteLoginBanner saved = siteLoginBannerService.saveBanner(companyId, updatedBy, payload.get("imageData"));
        return ResponseEntity.ok(saved);
    }
}
