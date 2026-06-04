package naeil.dashboard.common.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import naeil.dashboard.service.AuthService;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final AuthService authService;
    private final ObjectMapper objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }

        String path = request.getRequestURI();
        if ("/api/auth/login".equals(path)
                || "/api/auth/register".equals(path)
                || "/api/auth/invites/preview".equals(path)
                || "/api/auth/session".equals(path)
                || "/api/auth/logout".equals(path)
                || "/api/health".equals(path)
                || path.startsWith("/api/executive/diag/")) {  // 임시 진단용
            return true;
        }

        return authService.authenticate(request.getHeader("Authorization"))
                .map(user -> {
                    request.setAttribute(AuthService.AUTHENTICATED_USERNAME_ATTR, user.username());
                    request.setAttribute(AuthService.AUTHENTICATED_ROLE_ATTR, user.role());
                    request.setAttribute(AuthService.AUTHENTICATED_USER_ATTR, user);
                    if (!hasApiAccess(path, user)) {
                        writeJson(response, HttpServletResponse.SC_FORBIDDEN, "접근 권한이 없습니다.");
                        return false;
                    }
                    return true;
                })
                .orElseGet(() -> {
                    writeJson(response, HttpServletResponse.SC_UNAUTHORIZED, "로그인이 필요합니다.");
                    return false;
                });
    }

    private boolean hasApiAccess(String path, AuthUser user) {
        UserRole role = UserRole.from(user.role());
        if (role == UserRole.EXECUTIVE) {
            return true;
        }

        if (path.startsWith("/api/auth/users")) {
            return false;
        }
        if (path.startsWith("/api/auth/invites")) {
            return role == UserRole.MANAGER;
        }
        if (isExecutiveOnlyPath(path)) {
            return false;
        }
        if (isManagerOnlyPath(path)) {
            return role == UserRole.MANAGER;
        }
        return true;
    }

    private boolean isExecutiveOnlyPath(String path) {
        return path.startsWith("/api/executive/summary")
                || path.startsWith("/api/executive/cash-flow")
                || path.startsWith("/api/executive/operating-expenses")
                || path.startsWith("/api/executive/debts")
                || path.startsWith("/api/executive/issues");
    }

    private boolean isManagerOnlyPath(String path) {
        return path.matches("^/api/executive/payment-requests/\\d+/approve$")
                || path.startsWith("/api/executive/product-movements/sync-playauto")
                || path.startsWith("/api/executive/receivables")
                || path.startsWith("/api/executive/cash-accounts")
                || path.startsWith("/api/executive/cash-flows");
    }

    private void writeJson(HttpServletResponse response, int status, String message) {
        try {
            response.setStatus(status);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            objectMapper.writeValue(response.getWriter(), Map.of(
                    "status", status,
                    "message", message
            ));
        } catch (Exception ignored) {
            // Response write failure can be ignored here.
        }
    }
}
