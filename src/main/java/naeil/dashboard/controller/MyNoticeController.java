package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.MyNoticeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** 로그인 알림 — 나에게 온 업무 지시·피드백, 새로 배정된 업무(아직 확인 안 한 것). */
@RestController
@RequestMapping("/api/my-notices")
@RequiredArgsConstructor
public class MyNoticeController {

    private final MyNoticeService myNoticeService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> unseen(HttpServletRequest request) {
        AuthUser u = requireUser(request);
        return ResponseEntity.ok(myNoticeService.unseen(companyOf(u), u.username(), u.displayName()));
    }

    /** { items: [{ type: FEEDBACK|TASK, id }] } */
    @PostMapping("/seen")
    public ResponseEntity<Map<String, Object>> seen(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        AuthUser u = requireUser(request);
        return ResponseEntity.ok(myNoticeService.markSeen(companyOf(u), u.username(), body == null ? null : body.get("items")));
    }

    private static Long companyOf(AuthUser u) { return u.companyId() == null ? 1L : u.companyId(); }

    private AuthUser requireUser(HttpServletRequest request) {
        AuthUser actor = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
        if (actor == null) throw new CustomException(401, "로그인이 필요합니다.");
        return actor;
    }
}
