package naeil.dashboard.controller;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.PlayAutoProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 플레이오토 온라인상품 조회·수정 (매니저 이상).
 * 판매가 변경은 서비스에서 대표만 허용한다.
 */
@RestController
@RequestMapping("/api/playauto-products")
@RequiredArgsConstructor
public class PlayAutoProductController {

    private final PlayAutoProductService playAutoProductService;
    private final AuthService authService;

    @GetMapping
    public ResponseEntity<JsonNode> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String saleStatus,
            @RequestParam(defaultValue = "0") int start,
            @RequestParam(defaultValue = "50") int length,
            HttpServletRequest request) {
        requireManager(request);
        return ResponseEntity.ok(playAutoProductService.search(keyword, saleStatus, start, length));
    }

    @GetMapping("/{olShopNo}")
    public ResponseEntity<JsonNode> detail(@PathVariable String olShopNo, HttpServletRequest request) {
        requireManager(request);
        return ResponseEntity.ok(playAutoProductService.detail(olShopNo));
    }

    @PostMapping("/check-claims")
    public ResponseEntity<List<Map<String, String>>> checkClaims(@RequestBody Map<String, String> body,
                                                                 HttpServletRequest request) {
        requireManager(request);
        return ResponseEntity.ok(playAutoProductService.checkClaims(
                body.get("shop_sale_name"), body.get("detail_desc"), body.get("keywords")));
    }

    @PutMapping("/edit")
    public ResponseEntity<Map<String, Object>> edit(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        return ResponseEntity.ok(playAutoProductService.edit(body, requireManager(request)));
    }

    private AuthUser requireManager(HttpServletRequest request) {
        AuthUser actor = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
        authService.requireRole(actor, UserRole.MANAGER);
        return actor;
    }
}
