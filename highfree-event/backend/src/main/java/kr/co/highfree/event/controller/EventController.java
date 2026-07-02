package kr.co.highfree.event.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kr.co.highfree.event.dto.Dtos.*;
import kr.co.highfree.event.service.EventService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class EventController {

    private final EventService eventService;

    public EventController(EventService eventService) {
        this.eventService = eventService;
    }

    @PostMapping("/sessions")
    public ResponseEntity<SessionResponse> createSession(
            @RequestBody SessionRequest req,
            HttpServletRequest httpReq) {
        String ip = httpReq.getHeader("X-Forwarded-For");
        if (ip == null) ip = httpReq.getRemoteAddr();
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
}
