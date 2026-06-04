package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthSessionResponse;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.ChangePasswordRequest;
import naeil.dashboard.dto.InviteCreateRequest;
import naeil.dashboard.dto.LoginRequest;
import naeil.dashboard.dto.RegisterRequest;
import naeil.dashboard.dto.ResetPasswordRequest;
import naeil.dashboard.dto.UserRole;
import naeil.dashboard.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<AuthSessionResponse> login(@RequestBody LoginRequest request, HttpSession session) {
        AuthUser user = authService.login(request.resolvedLoginId(), request.password());
        session.setAttribute("daouLoginId", request.resolvedLoginId());
        session.setAttribute("daouPassword", request.password());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        user.username(),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + user.role()))
                )
        );
        return ResponseEntity.ok(toSession(user, authService.createToken(user)));
    }

    @GetMapping("/session")
    public ResponseEntity<AuthSessionResponse> getSession(HttpServletRequest request) {
        return authService.authenticate(request.getHeader("Authorization"))
                .map(user -> ResponseEntity.ok(toSession(user, null)))
                .orElseGet(() -> ResponseEntity.ok(new AuthSessionResponse(false, null, null, null, null, null, null, null)));
    }

    @PostMapping("/register")
    public ResponseEntity<AuthSessionResponse> register(@RequestBody RegisterRequest request) {
        AuthUser user = authService.register(request);
        return ResponseEntity.ok(toSession(user, authService.createToken(user)));
    }

    @GetMapping("/invites/preview")
    public ResponseEntity<Map<String, Object>> previewInvite(@RequestParam String inviteCode) {
        return ResponseEntity.ok(authService.previewInvite(inviteCode));
    }

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getUsers(HttpServletRequest request) {
        AuthUser actor = requireUser(request);
        authService.requireRole(actor, UserRole.EXECUTIVE);
        return ResponseEntity.ok(authService.listUsers());
    }

    @GetMapping("/invites")
    public ResponseEntity<List<Map<String, Object>>> getInvites(HttpServletRequest request) {
        AuthUser actor = requireUser(request);
        authService.requireRole(actor, UserRole.MANAGER);
        return ResponseEntity.ok(authService.listInvites());
    }

    @PostMapping("/invites")
    public ResponseEntity<Map<String, Object>> createInvite(
            HttpServletRequest request,
            @RequestBody InviteCreateRequest inviteRequest
    ) {
        AuthUser actor = requireUser(request);
        authService.requireRole(actor, UserRole.MANAGER);
        return ResponseEntity.ok(authService.createInvite(inviteRequest, actor));
    }

    @PostMapping("/password")
    public ResponseEntity<Map<String, String>> changePassword(
            HttpServletRequest request,
            @RequestBody ChangePasswordRequest passwordRequest
    ) {
        AuthUser actor = requireUser(request);
        authService.changePassword(passwordRequest, actor);
        return ResponseEntity.ok(Map.of("message", "비밀번호가 변경되었습니다."));
    }

    @PostMapping("/users/{id}/password")
    public ResponseEntity<Map<String, String>> resetPassword(
            HttpServletRequest request,
            @PathVariable Long id,
            @RequestBody ResetPasswordRequest passwordRequest
    ) {
        AuthUser actor = requireUser(request);
        authService.resetPassword(id, passwordRequest, actor);
        return ResponseEntity.ok(Map.of("message", "비밀번호가 초기화되었습니다."));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpSession session) {
        session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("message", "로그아웃되었습니다."));
    }

    @PostMapping("/users/{id}/menu-permissions")
    public ResponseEntity<Map<String, String>> updateMenuPermissions(
            HttpServletRequest request,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        requireUser(request);  // EXECUTIVE 권한은 AuthInterceptor에서 보장
        Object sections = body.get("sections");
        String sectionsJson = sections != null ? sections.toString() : null;
        authService.updateMenuPermissions(id, sectionsJson);
        return ResponseEntity.ok(Map.of("message", "메뉴 권한이 저장되었습니다."));
    }

    private AuthSessionResponse toSession(AuthUser user, String token) {
        return new AuthSessionResponse(
                true,
                user.username(),
                user.displayName(),
                user.department(),
                user.positionName(),
                user.role(),
                token,
                user.allowedMenuSections()
        );
    }

    private AuthUser requireUser(HttpServletRequest request) {
        return (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
    }
}
