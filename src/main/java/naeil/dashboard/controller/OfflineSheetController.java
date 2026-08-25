package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.service.OfflineSheetService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 오프라인 발주 구글시트 Apps Script 수신 엔드포인트.
 * JWT 미적용 경로(AuthInterceptor 화이트리스트) — 요청 본문의 secret 을
 * channel_api_credential(OFFLINE_SHEET) 시크릿과 대조해 인증한다.
 */
@Slf4j
@RestController
@RequestMapping("/api/integrations/offline-sheet")
@RequiredArgsConstructor
public class OfflineSheetController {

    private final OfflineSheetService offlineSheetService;
    private final naeil.dashboard.service.SettleSheetService settleSheetService;

    @PostMapping("/import")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> importRows(@RequestBody Map<String, Object> payload) {
        String secret = payload.get("secret") == null ? null : String.valueOf(payload.get("secret"));
        if (!offlineSheetService.isValidSecret(secret)) {
            log.warn("[OfflineSheet] invalid secret from import request");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "인증 실패"));
        }
        Object rowsObj = payload.get("rows");
        if (!(rowsObj instanceof List<?> rows) || rows.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "rows 비어 있음"));
        }
        try {
            return ResponseEntity.ok(offlineSheetService.importRows((List<Map<String, Object>>) rowsObj));
        } catch (Exception e) {
            log.error("[OfflineSheet] import failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", e.getMessage() == null ? "서버 오류" : e.getMessage()));
        }
    }

    /** 정산시트: 상품명 → 브랜드 매핑 */
    @PostMapping("/import-mapping")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> importMapping(@RequestBody Map<String, Object> payload) {
        ResponseEntity<Map<String, Object>> auth = checkSecret(payload);
        if (auth != null) return auth;
        Object rows = payload.get("rows");
        if (!(rows instanceof List<?> list) || list.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "rows 비어 있음"));
        }
        try {
            return ResponseEntity.ok(settleSheetService.importMapping((List<Map<String, Object>>) rows));
        } catch (Exception e) {
            log.error("[SettleSheet] mapping failed", e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", String.valueOf(e.getMessage())));
        }
    }

    /** 정산시트: 과거 매출 백필 (2025 전체 + 2026 미커버 매체) */
    @PostMapping("/import-legacy-sales")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> importLegacySales(@RequestBody Map<String, Object> payload) {
        ResponseEntity<Map<String, Object>> auth = checkSecret(payload);
        if (auth != null) return auth;
        Object rows = payload.get("rows");
        if (!(rows instanceof List<?> list) || list.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "rows 비어 있음"));
        }
        boolean replaceLegacy = Boolean.TRUE.equals(payload.get("replaceLegacy"));
        try {
            return ResponseEntity.ok(settleSheetService.importLegacySales((List<Map<String, Object>>) rows, replaceLegacy));
        } catch (Exception e) {
            log.error("[SettleSheet] legacy sales failed", e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", String.valueOf(e.getMessage())));
        }
    }

    /** 정산시트: 출고 데이터 → product_outbound */
    @PostMapping("/import-outbound")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> importOutbound(@RequestBody Map<String, Object> payload) {
        ResponseEntity<Map<String, Object>> auth = checkSecret(payload);
        if (auth != null) return auth;
        Object rows = payload.get("rows");
        if (!(rows instanceof List<?> list) || list.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "rows 비어 있음"));
        }
        try {
            return ResponseEntity.ok(settleSheetService.importOutbound((List<Map<String, Object>>) rows));
        } catch (Exception e) {
            log.error("[SettleSheet] outbound failed", e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", String.valueOf(e.getMessage())));
        }
    }

    private ResponseEntity<Map<String, Object>> checkSecret(Map<String, Object> payload) {
        String secret = payload.get("secret") == null ? null : String.valueOf(payload.get("secret"));
        if (!offlineSheetService.isValidSecret(secret)) {
            log.warn("[SettleSheet] invalid secret");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "인증 실패"));
        }
        return null;
    }
}
