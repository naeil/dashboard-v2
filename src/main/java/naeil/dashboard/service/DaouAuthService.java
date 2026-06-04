package naeil.dashboard.service;

import naeil.dashboard.common.config.DaouProperties;
import naeil.dashboard.common.exception.CustomException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@Service
public class DaouAuthService {

    private static final String COMPANY_AUTH_KEY_PATH = "/public/v2/alliance/company";
    private static final String ACCESS_TOKEN_PATH = "/public/auth/v1/oauth2/token";

    private final RestTemplate restTemplate;
    private final DaouProperties daouProperties;

    private volatile CachedToken cachedToken;

    public DaouAuthService(RestTemplate restTemplate, DaouProperties daouProperties) {
        this.restTemplate = restTemplate;
        this.daouProperties = daouProperties;
    }

    public Map<String, Object> issueCompanyAuthKey() {
        Map<String, Object> payload = new LinkedHashMap<>();
        putIfPresent(payload, "companyId", daouProperties.companyId());
        putIfPresent(payload, "companyName", daouProperties.companyName());
        putIfPresent(payload, "domain", daouProperties.domain());
        putIfPresent(payload, "callbackUrl", daouProperties.callbackUrl());
        return issueCompanyAuthKey(payload);
    }

    public Map<String, Object> issueCompanyAuthKey(Map<String, Object> payload) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        return postForMap(
                COMPANY_AUTH_KEY_PATH,
                new HttpEntity<>(payload == null ? Map.of() : payload, headers),
                "다우오피스 인증키 발급 실패"
        );
    }

    public String issueAccessToken() {
        CachedToken current = cachedToken;
        if (current != null && current.isValid(daouProperties)) {
            return current.accessToken();
        }

        synchronized (this) {
            current = cachedToken;
            if (current != null && current.isValid(daouProperties)) {
                return current.accessToken();
            }

            Map<String, Object> response = requestAccessToken();
            String accessToken = asText(response.get("access_token"));
            if (!hasText(accessToken)) {
                throw new CustomException(502, "다우오피스 Access Token 응답에 access_token이 없습니다.");
            }

            long expiresIn = asLong(response.get("expires_in"), 3600L);
            cachedToken = new CachedToken(accessToken, Instant.now().plusSeconds(expiresIn));
            return accessToken;
        }
    }

    public HttpHeaders bearerHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(issueAccessToken());
        return headers;
    }

    public String bearerHeaderValue() {
        return "Bearer " + issueAccessToken();
    }

    public void clearCachedAccessToken() {
        cachedToken = null;
    }

    private Map<String, Object> requestAccessToken() {
        validateClientCredentials();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(daouProperties.clientId(), daouProperties.clientSecret());

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "client_credentials");

        return postForMap(
                ACCESS_TOKEN_PATH,
                new HttpEntity<>(body, headers),
                "다우오피스 Access Token 발급 실패"
        );
    }

    private Map<String, Object> postForMap(String path, HttpEntity<?> entity, String failureMessage) {
        try {
            Map<?, ?> response = restTemplate.postForObject(daouProperties.resolvedBaseUrl() + path, entity, Map.class);
            if (response == null) {
                return Map.of();
            }
            Map<String, Object> normalized = new LinkedHashMap<>();
            response.forEach((key, value) -> normalized.put(String.valueOf(key), value));
            return normalized;
        } catch (RestClientException e) {
            throw new CustomException(502, failureMessage + ": " + e.getMessage());
        }
    }

    private void validateClientCredentials() {
        if (!hasText(daouProperties.clientId()) || !hasText(daouProperties.clientSecret())) {
            throw new CustomException(400, "다우오피스 client-id/client-secret 설정이 필요합니다.");
        }
    }

    private void putIfPresent(Map<String, Object> payload, String key, String value) {
        if (hasText(value)) {
            payload.put(key, value.trim());
        }
    }

    private String asText(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private long asLong(Object value, long defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private record CachedToken(String accessToken, Instant expiresAt) {
        boolean isValid(DaouProperties properties) {
            Objects.requireNonNull(properties, "properties");
            return expiresAt.minus(properties.resolvedTokenRefreshSkew()).isAfter(Instant.now());
        }
    }
}
