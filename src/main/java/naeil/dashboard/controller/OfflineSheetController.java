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
}
