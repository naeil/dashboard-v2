package naeil.dashboard.dto;

import org.springframework.util.StringUtils;

public record LoginRequest(String loginId, String username, String password) {
    public String resolvedLoginId() {
        return StringUtils.hasText(loginId) ? loginId : username;
    }
}
