package naeil.dashboard.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.auth")
public record AuthProperties(
        String username,
        String password,
        String tokenSecret,
        long tokenTtlSeconds
) {
}
