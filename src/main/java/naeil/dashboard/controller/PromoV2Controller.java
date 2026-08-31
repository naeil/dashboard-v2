package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.service.PromoV2Service;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 프로모션 마진 / 행사 설계 v2 API (기능정의서 v1.0)
 * 행사(Promotion) 1:N 상품블록(ProductBlock) 1:N 옵션라인(OptionLine)
 */
@RestController
@RequestMapping("/api/promo-v2")
@RequiredArgsConstructor
public class PromoV2Controller {

    private final PromoV2Service promoV2Service;

    @GetMapping("/channel-defaults")
    public ResponseEntity<List<Map<String, Object>>> channelDefaults() {
        return ResponseEntity.ok(promoV2Service.getChannelDefaults());
    }

    @GetMapping("/products")
    public ResponseEntity<List<Map<String, Object>>> products(@RequestParam(required = false) String q) {
        return ResponseEntity.ok(promoV2Service.searchProducts(q));
    }

    @GetMapping("/events")
    public ResponseEntity<List<Map<String, Object>>> events(
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) String channel) {
        return ResponseEntity.ok(promoV2Service.listEvents(month, brand, channel));
    }

    @GetMapping("/events/{id}")
    public ResponseEntity<Map<String, Object>> event(@PathVariable Long id) {
        return ResponseEntity.ok(promoV2Service.getEvent(id));
    }

    @PostMapping("/events")
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> payload) {
        try {
            Long id = promoV2Service.saveEvent(null, payload);
            return ResponseEntity.ok(Map.of("success", true, "id", id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PutMapping("/events/{id}")
    public ResponseEntity<Map<String, Object>> update(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        try {
            promoV2Service.saveEvent(id, payload);
            return ResponseEntity.ok(Map.of("success", true, "id", id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PatchMapping("/events/{id}/status")
    public ResponseEntity<Map<String, Object>> updateStatus(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        promoV2Service.updateStatus(id, String.valueOf(payload.getOrDefault("status", "기획")));
        return ResponseEntity.ok(Map.of("success", true));
    }

    @DeleteMapping("/events/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable Long id) {
        promoV2Service.deleteEvent(id);
        return ResponseEntity.ok(Map.of("success", true));
    }

    /** 행사에 매핑된 상품코드의 기간 내 실시간 매출 (직연동 orders 기준) */
    @GetMapping("/events/{id}/realtime")
    public ResponseEntity<Map<String, Object>> realtime(@PathVariable Long id) {
        return ResponseEntity.ok(promoV2Service.getRealtimeSales(id));
    }

    /** 여러 행사의 실시간 매출 일괄 조회 — 목록/상태보드 BPE 달성률 표시용 (ids=1,2,3) */
    @GetMapping("/events/realtime-batch")
    public ResponseEntity<List<Map<String, Object>>> realtimeBatch(@RequestParam String ids) {
        List<Long> idList = new java.util.ArrayList<>();
        for (String part : ids.split(",")) {
            try {
                idList.add(Long.parseLong(part.trim()));
            } catch (NumberFormatException ignored) { /* skip */ }
        }
        if (idList.size() > 60) idList = idList.subList(0, 60);
        return ResponseEntity.ok(promoV2Service.getRealtimeBatch(idList));
    }
}
