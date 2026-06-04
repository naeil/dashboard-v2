package naeil.dashboard.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "daou")
public record DaouProperties(
        String baseUrl,
        String clientId,
        String clientSecret,
        String companyId,
        String companyName,
        String domain,
        String callbackUrl,
        Duration connectTimeout,
        Duration readTimeout,
        Duration tokenRefreshSkew,
        Mail mail
) {
    public String resolvedBaseUrl() {
        return hasText(baseUrl) ? stripTrailingSlash(baseUrl) : "https://api.daouoffice.com";
    }

    public Duration resolvedConnectTimeout() {
        return connectTimeout != null ? connectTimeout : Duration.ofSeconds(5);
    }

    public Duration resolvedReadTimeout() {
        return readTimeout != null ? readTimeout : Duration.ofSeconds(20);
    }

    public Duration resolvedTokenRefreshSkew() {
        return tokenRefreshSkew != null ? tokenRefreshSkew : Duration.ofSeconds(60);
    }

    private static String stripTrailingSlash(String value) {
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    public record Mail(
            String host,
            int port,
            String username,
            String password,
            String smtpHost,
            int smtpPort
    ) {
        public String resolvedHost() {
            return hasText(host) ? host : "imap.daouoffice.com";
        }

        public int resolvedPort() {
            return port > 0 ? port : 993;
        }

        public String resolvedSmtpHost() {
            return hasText(smtpHost) ? smtpHost : "outbound.daouoffice.com";
        }

        public int resolvedSmtpPort() {
            return smtpPort > 0 ? smtpPort : 465;
        }
    }
}
