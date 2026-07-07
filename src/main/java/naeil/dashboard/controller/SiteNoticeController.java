package naeil.dashboard.controller;

import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.entity.SiteNotice;
import naeil.dashboard.service.SiteNoticeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Login-page notice/update board REST API.
 * GET /api/public/notices is unauthenticated so the login page can show it
 * before the user signs in. All write operations require an authenticated
 * session (enforced by AuthInterceptor) and are used from the platform admin
 * console. Additive-only controller: does not modify any existing endpoint.
 */
@RestController
@RequiredArgsConstructor
public class SiteNoticeController {

    private final SiteNoticeService siteNoticeService;

    @GetMapping("/api/public/notices")
    public ResponseEntity<List<SiteNotice>> getPublicNotices(
        @RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(siteNoticeService.getNotices(companyId));
    }

    @GetMapping("/api/notices")
    public ResponseEntity<List<SiteNotice>> getNotices(
        @RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(siteNoticeService.getNotices(companyId));
    }

    @PostMapping("/api/notices")
    public ResponseEntity<SiteNotice> createNotice(
        @RequestParam(defaultValue = "1") Long companyId,
        @RequestParam(required = false) String createdBy,
        @RequestBody SiteNotice payload) {
        return ResponseEntity.ok(siteNoticeService.createNotice(companyId, createdBy, payload));
    }

    @PutMapping("/api/notices/{id}")
    public ResponseEntity<SiteNotice> updateNotice(
        @RequestParam(defaultValue = "1") Long companyId,
        @PathVariable Long id,
        @RequestBody SiteNotice payload) {
        return ResponseEntity.ok(siteNoticeService.updateNotice(companyId, id, payload));
    }

    @DeleteMapping("/api/notices/{id}")
    public ResponseEntity<Map<String, String>> deleteNotice(
        @RequestParam(defaultValue = "1") Long companyId,
        @PathVariable Long id) {
        siteNoticeService.deleteNotice(companyId, id);
        return ResponseEntity.ok(Map.of("message", "deleted"));
    }
}
