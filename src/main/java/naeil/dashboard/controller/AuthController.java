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
import org.springframework.web.bind.annotation.DeleteMapping;
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
    public ResponseEntity<AuthSessionResponse> platformLogin(@RequestBody LoginRequest request) {
        return loginWithRequest(request);
    }

    @PostMapping({"/tenant-login", "/tenent-login"})
    public ResponseEntity<AuthSessionResponse> tenantLogin(@RequestBody LoginRequest request) {
        return loginWithRequest(request);
    }

    @GetMapping("/session")
    public ResponseEntity<AuthSessionResponse> getSession(HttpServletRequest request) {
        return authService.authenticate(request.getHeader("Authorization"))
            .map(user -> ResponseEntity.ok(toSession(user, null)))
            .orElseGet(() -> ResponseEntity.ok(new AuthSessionResponse(
                false, null, null, null, null, null, null, null, null, null
            )));
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

    @GetMapping("/username-available")
    public ResponseEntity<Map<String, Object>> checkUsernameAvailable(
        @RequestParam String inviteCode,
        @RequestParam String username
    ) {
        return ResponseEntity.ok(authService.checkUsernameAvailable(inviteCode, username));
    }

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getUsers(HttpServletRequest request) {
        AuthUser actor = requireUser(request);
        if (!authService.canAccessEmployeeManagement(actor)) {
            authService.requireRole(actor, UserRole.EXECUTIVE);
        }
        return ResponseEntity.ok(authService.listUsers());
    }

    @GetMapping("/invites")
    public ResponseEntity<List<Map<String, Object>>> getInvites(HttpServletRequest request) {
        AuthUser actor = requireUser(request);
        if (!authService.canAccessEmployeeManagement(actor)) {
            authService.requireRole(actor, UserRole.MANAGER);
        }
        return ResponseEntity.ok(authService.listInvites());
    }

    @GetMapping("/position-permissions")
    public ResponseEntity<List<Map<String, Object>>> getPositionPermissionTemplates(HttpServletRequest request) {
        AuthUser actor = requireUser(request);
        return ResponseEntity.ok(authService.listPositionPermissionTemplates(actor));
    }

    @PostMapping("/invites")
    public ResponseEntity<Map<String, Object>> createInvite(
        HttpServletRequest request,
        @RequestBody InviteCreateRequest inviteRequest
    ) {
        AuthUser actor = requireUser(request);
        authService.requireFeature(actor, AuthService.FEATURE_CREATE_INVITE);
        return ResponseEntity.ok(authService.createInvite(inviteRequest, actor));
    }

    @DeleteMapping("/invites/{id}")
    public ResponseEntity<Map<String, String>> deleteInvite(
        HttpServletRequest request,
        @PathVariable Long id
    ) {
        AuthUser actor = requireUser(request);
        authService.deleteInvite(id, actor);
        return ResponseEntity.ok(Map.of("message", "\uCD08\uB300 \uB9C1\uD06C\uB97C \uC0AD\uC81C\uD588\uC2B5\uB2C8\uB2E4."));
    }

    @PostMapping("/password")
    public ResponseEntity<Map<String, String>> changePassword(
        HttpServletRequest request,
        @RequestBody ChangePasswordRequest passwordRequest
    ) {
        AuthUser actor = requireUser(request);
        authService.changePassword(passwordRequest, actor);
        return ResponseEntity.ok(Map.of("message", "\uBE44\uBC00\uBC88\uD638\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4."));
    }

    @PostMapping("/users/{id}/password")
    public ResponseEntity<Map<String, String>> resetPassword(
        HttpServletRequest request,
        @PathVariable Long id,
        @RequestBody ResetPasswordRequest passwordRequest
    ) {
        AuthUser actor = requireUser(request);
        authService.resetPassword(id, passwordRequest, actor);
        return ResponseEntity.ok(Map.of("message", "\uBE44\uBC00\uBC88\uD638\uAC00 \uCD08\uAE30\uD654\uB418\uC5C8\uC2B5\uB2C8\uB2E4."));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Map<String, String>> deleteUser(
        HttpServletRequest request,
        @PathVariable Long id
    ) {
        AuthUser actor = requireUser(request);
        authService.deleteUser(id, actor);
        return ResponseEntity.ok(Map.of("message", "\uC9C1\uC6D0 \uACC4\uC815\uC744 \uD1F4\uC0AC \uCC98\uB9AC\uD588\uC2B5\uB2C8\uB2E4."));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpSession session) {
        session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("message", "\uB85C\uADF8\uC544\uC6C3\uB418\uC5C8\uC2B5\uB2C8\uB2E4."));
    }

    @PostMapping("/users/{id}/menu-permissions")
    public ResponseEntity<Map<String, String>> updateMenuPermissions(
        HttpServletRequest request,
        @PathVariable Long id,
        @RequestBody Map<String, Object> body) {
        AuthUser actor = requireUser(request);
        authService.requireFeature(actor, AuthService.FEATURE_MANAGE_MENU_PERMISSIONS);
        String sectionsJson = (String) body.get("sections");
        authService.updateMenuPermissions(id, sectionsJson);
        return ResponseEntity.ok(Map.of("message", "\uBA54\uB274 \uAD8C\uD55C\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4."));
    }

    @PostMapping("/position-permissions")
    public ResponseEntity<Map<String, Object>> savePositionPermissionTemplate(
        HttpServletRequest request,
        @RequestBody Map<String, Object> body) {
        AuthUser actor = requireUser(request);
        return ResponseEntity.ok(authService.savePositionPermissionTemplate(body, actor));
    }

    // ===== \uBE44\uBC00\uBC88\uD638 \uCC3E\uAE30 - SMS OTP =====

    /** STEP 1: \uD734\uB300\uD3F0 \uBC88\uD638 \uC778\uC99D \uBC1C\uC1A1 */
    @PostMapping("/password-reset/request")
    public ResponseEntity<Map<String, Object>> requestPasswordReset(
        @RequestBody Map<String, String> body
    ) {
        String companyCode = body.get("companyCode");
        String loginId = body.get("loginId");
        String phoneNumber = body.get("phoneNumber");
        Map<String, Object> result = authService.requestPasswordReset(companyCode, loginId, phoneNumber);
        return ResponseEntity.ok(result);
    }

    /** STEP 2: OTP \uD655\uC778 + \uC0C8 \uBE44\uBC00\uBC88\uD638 \uC124\uC815 */
    @PostMapping("/password-reset/verify")
    public ResponseEntity<Map<String, String>> verifyPasswordReset(
        @RequestBody Map<String, String> body
    ) {
        String companyCode = body.get("companyCode");
        String loginId = body.get("loginId");
        String phoneNumber = body.get("phoneNumber");
        String otpCode = body.get("otpCode");
        String newPassword = body.get("newPassword");
        authService.verifyAndResetPassword(companyCode, loginId, phoneNumber, otpCode, newPassword);
        return ResponseEntity.ok(Map.of("message", "\uBE44\uBC00\uBC88\uD638\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4."));
    }

    private ResponseEntity<AuthSessionResponse> loginWithRequest(LoginRequest request) {
        AuthUser user = authService.login(request.resolvedCompanyCode(), request.resolvedLoginId(), request.password());
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                user.username(),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.role()))
            )
        );
        return ResponseEntity.ok(toSession(user, authService.createToken(user)));
    }

    private AuthSessionResponse toSession(AuthUser user, String token) {
        return new AuthSessionResponse(
            true,
            user.username(),
            user.displayName(),
            user.department(),
            user.positionName(),
            user.role(),
            user.accountScope(),
            user.accountLevel(),
            token,
            user.allowedMenuSections()
        );
    }

    private AuthUser requireUser(HttpServletRequest request) {
        return (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
    }
}
