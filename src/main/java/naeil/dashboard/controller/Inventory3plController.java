package naeil.dashboard.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 3PL 일일재고표 업로드 — 재고 현황 화면의 기준 데이터(일별 입고·출고·재고)를 저장하고 최신본을 돌려준다.
 * 현재고 수량 자체는 기존 product-profits 레코드(stock_quantity)에 반영한다.
 */
@RestController
@RequestMapping("/api/executive/inventory-3pl")
@RequiredArgsConstructor
public class Inventory3plController {

    private static final int MAX_PAYLOAD_LENGTH = 2_000_000;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @GetMapping("/latest")
    public ResponseEntity<Map<String, Object>> latest(@RequestParam(defaultValue = "1") Long companyId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, as_of_date, file_name, uploaded_by, item_count, payload, created_at
                FROM inventory_3pl_snapshot
                WHERE company_id = ?
                ORDER BY created_at DESC, id DESC
                LIMIT 1
                """, companyId);
        Map<String, Object> body = new HashMap<>();
        body.put("snapshot", rows.isEmpty() ? null : rows.get(0));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/history")
    public ResponseEntity<List<Map<String, Object>>> history(@RequestParam(defaultValue = "1") Long companyId) {
        return ResponseEntity.ok(jdbcTemplate.queryForList("""
                SELECT id, as_of_date, file_name, uploaded_by, item_count, created_at
                FROM inventory_3pl_snapshot
                WHERE company_id = ?
                ORDER BY created_at DESC, id DESC
                LIMIT 30
                """, companyId));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> save(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        LocalDate asOfDate;
        try {
            asOfDate = LocalDate.parse(String.valueOf(body.get("asOfDate")).substring(0, 10));
        } catch (Exception e) {
            return fail("기준일 형식이 올바르지 않습니다.");
        }

        Object payload = body.get("payload");
        if (!(payload instanceof Map<?, ?> payloadMap)) {
            return fail("업로드할 재고 데이터가 없습니다.");
        }
        Object items = payloadMap.get("items");
        int itemCount = items instanceof List<?> list ? list.size() : 0;
        if (itemCount == 0) {
            return fail("업로드할 재고 품목이 없습니다.");
        }

        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return fail("재고 데이터를 저장할 수 없는 형식입니다.");
        }
        if (json.length() > MAX_PAYLOAD_LENGTH) {
            return fail("재고 데이터가 너무 큽니다.");
        }

        String fileName = body.get("fileName") == null ? null : String.valueOf(body.get("fileName")).trim();
        if (fileName != null && fileName.length() > 255) {
            fileName = fileName.substring(0, 255);
        }
        AuthUser user = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
        String uploadedBy = user == null ? null : user.username();

        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO inventory_3pl_snapshot (company_id, as_of_date, file_name, uploaded_by, item_count, payload)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class, companyId, java.sql.Date.valueOf(asOfDate), fileName, uploadedBy, itemCount, json);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("id", id);
        return ResponseEntity.ok(result);
    }

    private static ResponseEntity<Map<String, Object>> fail(String message) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", false);
        result.put("message", message);
        return ResponseEntity.badRequest().body(result);
    }
}
