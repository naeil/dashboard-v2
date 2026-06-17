package naeil.dashboard.service;

import jakarta.mail.Session;
import jakarta.mail.Store;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;
import java.util.Properties;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import naeil.dashboard.dto.IntegrationSettingDto;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class ExternalIntegrationValidationService {

    private static final String NAVER_SEARCH_URL = "https://openapi.naver.com/v1/search/blog.json";
    private static final String NAVER_AD_BASE_URL = "https://api.searchad.naver.com";
    private static final String META_GRAPH_BASE_URL = "https://graph.facebook.com/v25.0";

    private final RestTemplate restTemplate;

    public ExternalIntegrationValidationService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public boolean validate(IntegrationSettingDto.ValidateRequest request) {
        return validateWithResult(request).success();
    }

    public ValidationResult validateWithResult(IntegrationSettingDto.ValidateRequest request) {
        if (request == null || request.getIntegrationType() == null) {
            return ValidationResult.failure("Integration type is required.");
        }

        try {
            return switch (request.getIntegrationType()) {
                case NAVER_SEARCH -> validateNaverSearch(request);
                case NAVER_BLOG -> validateNaverBlog(request);
                case NAVER_AD -> validateNaverAd(request);
                case META_ADS -> validateMetaAds(request);
                case DAOU_MAIL -> validateDaouMail(request);
                default -> ValidationResult.failure("This integration does not support validation.");
            };
        } catch (HttpStatusCodeException e) {
            return ValidationResult.failure(
                    providerName(request) + " validation was rejected. (HTTP "
                            + e.getStatusCode().value() + ")" + providerErrorMessage(e)
            );
        } catch (ResourceAccessException e) {
            return ValidationResult.failure(providerName(request) + " server is unreachable.");
        } catch (Exception e) {
            return ValidationResult.failure(providerName(request) + " credentials could not be validated.");
        }
    }

    private ValidationResult validateNaverSearch(IntegrationSettingDto.ValidateRequest request) {
        if (isBlank(request.getApiKey()) || isBlank(request.getPassword())) {
            return ValidationResult.failure("NAVER Search API requires Client ID and Client Secret.");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Naver-Client-Id", request.getApiKey().trim());
        headers.set("X-Naver-Client-Secret", request.getPassword().trim());
        String url = UriComponentsBuilder.fromHttpUrl(NAVER_SEARCH_URL)
                .queryParam("query", "NAEIL")
                .queryParam("display", 1)
                .build()
                .toUriString();
        restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
        return ValidationResult.success("NAVER Search API credentials are valid.");
    }

    private ValidationResult validateNaverBlog(IntegrationSettingDto.ValidateRequest request) {
        return ValidationResult.failure("NAVER Blog writing API is no longer available for validation.");
    }

    private ValidationResult validateNaverAd(IntegrationSettingDto.ValidateRequest request) throws GeneralSecurityException {
        if (isBlank(request.getApiKey()) || isBlank(request.getEmail()) || isBlank(request.getPassword())) {
            return ValidationResult.failure("NAVER Search Ad API requires Customer ID, Access License, and Secret Key.");
        }

        String customerId = request.getApiKey().trim();
        String path = "/ncc/campaigns";
        String timestamp = String.valueOf(System.currentTimeMillis());
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Timestamp", timestamp);
        headers.set("X-API-KEY", request.getEmail().trim());
        headers.set("X-Customer", customerId);
        headers.set("X-Signature", signNaverAd(timestamp, HttpMethod.GET.name(), path, request.getPassword().trim()));
        restTemplate.exchange(
                NAVER_AD_BASE_URL + path,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );
        return ValidationResult.success("NAVER Search Ad API credentials are valid.");
    }

    private ValidationResult validateMetaAds(IntegrationSettingDto.ValidateRequest request) {
        if (isBlank(request.getApiKey()) || isBlank(request.getEmail())) {
            return ValidationResult.failure("Meta Ads API requires Access Token and Ad Account ID.");
        }

        String accountId = request.getEmail().trim();
        if (accountId.startsWith("act_")) {
            accountId = accountId.substring(4);
        }
        String url = UriComponentsBuilder.fromHttpUrl(META_GRAPH_BASE_URL + "/act_" + accountId)
                .queryParam("fields", "id,name,account_status")
                .queryParam("access_token", request.getApiKey().trim())
                .build()
                .encode()
                .toUriString();
        restTemplate.getForEntity(url, String.class);
        return ValidationResult.success("Meta Ads API credentials are valid.");
    }

    private ValidationResult validateDaouMail(IntegrationSettingDto.ValidateRequest request) throws Exception {
        if (isBlank(request.getApiKey()) || isBlank(request.getEmail()) || isBlank(request.getPassword())) {
            return ValidationResult.failure("DaouOffice Mail requires IMAP server, mail ID, and password.");
        }

        Properties properties = new Properties();
        properties.put("mail.store.protocol", "imaps");
        properties.put("mail.imaps.connectiontimeout", "5000");
        properties.put("mail.imaps.timeout", "5000");
        Store store = Session.getInstance(properties).getStore("imaps");
        try {
            store.connect(request.getApiKey().trim(), 993, request.getEmail().trim(), request.getPassword());
            return store.isConnected()
                    ? ValidationResult.success("DaouOffice Mail credentials are valid.")
                    : ValidationResult.failure("DaouOffice Mail login failed.");
        } finally {
            if (store.isConnected()) {
                store.close();
            }
        }
    }

    private String signNaverAd(String timestamp, String method, String path, String secret)
            throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] signature = mac.doFinal((timestamp + "." + method + "." + path)
                .getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(signature);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String providerName(IntegrationSettingDto.ValidateRequest request) {
        return switch (request.getIntegrationType()) {
            case NAVER_SEARCH -> "NAVER Search API";
            case NAVER_BLOG -> "NAVER Blog API";
            case NAVER_AD -> "NAVER Search Ad API";
            case META_ADS -> "Meta Ads API";
            case DAOU_MAIL -> "DaouOffice Mail";
            default -> "External service";
        };
    }

    private String providerErrorMessage(HttpStatusCodeException exception) {
        String body = exception.getResponseBodyAsString();
        if (body == null || body.isBlank()) {
            return "";
        }
        String compactBody = body.replaceAll("\\s+", " ").trim();
        if (compactBody.length() > 300) {
            compactBody = compactBody.substring(0, 300) + "...";
        }
        return ": " + compactBody;
    }

    public record ValidationResult(boolean success, String message) {
        public static ValidationResult success(String message) {
            return new ValidationResult(true, message);
        }

        public static ValidationResult failure(String message) {
            return new ValidationResult(false, message);
        }
    }
}
