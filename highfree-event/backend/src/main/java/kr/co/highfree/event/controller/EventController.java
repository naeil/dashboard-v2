package kr.co.highfree.event.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kr.co.highfree.event.dto.Dtos.*;
import kr.co.highfree.event.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @PostMapping("/sessions")
    public ResponseEntity<SessionResponse> createSession(
            @RequestBody SessionRequest req,
            HttpServletRequest httpReq) {
        String ip = getClientIp(httpReq);
        String ua = httpReq.getHeader("User-Agent");
        return ResponseEntity.ok(eventService.createSession(req, ip, ua));
    }

    @PostMapping("/spin")
    public ResponseEntity<SpinResponse> spin(@Valid @RequestBody SpinRequest req) {
        return ResponseEntity.ok(eventService.spin(req));
    }

    @PostMapping("/double")
    public ResponseEntity<DoubleResponse> doubleUp(@Valid @RequestBody DoubleRequest req) {
        return ResponseEntity.ok(eventService.doubleUp(req));
    }

    @PostMapping("/claim")
    public ResponseEntity<ClaimResponse> claim(@Valid @RequestBody ClaimRequest req) {
        return ResponseEntity.ok(eventService.claim(req));
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, String>> handleBizEx(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    private String getClientIp(HttpServletRequest req) {
        String xForwardedFor = req.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}
