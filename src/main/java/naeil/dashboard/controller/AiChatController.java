package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AiChatService;
import naeil.dashboard.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiChatController {

    private final AiChatService aiChatService;

    @PostMapping("/chat")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> chat(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request
    ) {
        AuthUser user = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
        String message = payload.get("message") == null ? "" : String.valueOf(payload.get("message"));
        Object historyObj = payload.get("history");
        List<Map<String, Object>> history = historyObj instanceof List<?> ? (List<Map<String, Object>>) historyObj : List.of();
        return ResponseEntity.ok(aiChatService.chat(companyId, user, message, history));
    }
}
