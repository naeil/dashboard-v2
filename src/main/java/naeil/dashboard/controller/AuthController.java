package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthSessionResponse;
import naeil.dashboard.dto.LoginRequest;
import naeil.dashboard.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<AuthSessionResponse> login(@RequestBody LoginRequest request) {
        String token = authService.login(request.username(), request.password());
        return ResponseEntity.ok(new AuthSessionResponse(true, request.username(), token));
    }

    @GetMapping("/session")
    public ResponseEntity<AuthSessionResponse> getSession(HttpServletRequest request) {
        return authService.authenticate(request.getHeader("Authorization"))
                .map(username -> ResponseEntity.ok(new AuthSessionResponse(true, username, null)))
                .orElseGet(() -> ResponseEntity.ok(new AuthSessionResponse(false, null, null)));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout() {
        return ResponseEntity.ok(Map.of("message", "로그아웃되었습니다."));
    }
}
