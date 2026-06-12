package naeil.dashboard.dto;

import org.springframework.util.StringUtils;

public record LoginRequest(String companyCode, String loginId, String username, String password) {
    public String resolvedLoginId() {
        return StringUtils.hasText(loginId) ? loginId : username;
    }

    public String resolvedCompanyCode() {
        return StringUtils.hasText(companyCode) ? companyCode.trim().toUpperCase() : "";
    }
}
