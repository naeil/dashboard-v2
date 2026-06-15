package naeil.dashboard.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AiProviderSettingDto;
import naeil.dashboard.entity.AiProviderSetting;
import naeil.dashboard.enums.AiProvider;
import naeil.dashboard.repository.AiProviderSettingRepository;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

@Service
@Transactional(readOnly = true)
public class AiProviderSettingService {

    private static final String OPENAI_MODELS_URL = "https://api.openai.com/v1/models";
    private static final String CLAUDE_MODELS_URL = "https://api.anthropic.com/v1/models";
    private static final String GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
    private static final String CLAUDE_API_VERSION = "2023-06-01";

    private final AiProviderSettingRepository repository;
    private final RestTemplate restTemplate;

    public AiProviderSettingService(AiProviderSettingRepository repository, RestTemplate restTemplate) {
        this.repository = repository;
        this.restTemplate = restTemplate;
    }

    public List<AiProviderSettingDto.ProviderConfig> getProviderConfigs() {
        return List.of(
                new AiProviderSettingDto.ProviderConfig(
                        AiProvider.OPENAI,
                        "OpenAI",
                        "OpenAI API Key로 GPT 계열 모델을 연결합니다.",
                        List.of("apiKey"),
                        List.of("organizationId", "projectId"),
                        null,
                        List.of("gpt-4o", "gpt-4o-mini")
                ),
                new AiProviderSettingDto.ProviderConfig(
                        AiProvider.CLAUDE,
                        "Claude",
                        "Anthropic API Key로 Claude 모델을 연결합니다.",
                        List.of("apiKey"),
                        List.of(),
                        CLAUDE_API_VERSION,
                        List.of("claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022")
                ),
                new AiProviderSettingDto.ProviderConfig(
                        AiProvider.GEMINI,
                        "Gemini",
                        "Google AI Studio API Key로 Gemini 모델을 연결합니다.",
                        List.of("apiKey"),
                        List.of(),
                        null,
                        List.of("gemini-1.5-pro", "gemini-1.5-flash")
                )
        );
    }

    public List<AiProviderSettingDto.Response> getSettings(Long companyId) {
        return repository.findByCompanyIdOrderByProviderAsc(companyId)
                .stream()
                .map(AiProviderSettingDto.Response::from)
                .toList();
    }

    public ValidationResult validate(AiProviderSettingDto.ValidateRequest request) {
        if (request == null || request.provider() == null) {
            return ValidationResult.failure("AI 제공사를 선택해주세요.");
        }
        if (isBlank(request.apiKey())) {
            return ValidationResult.failure("API Key를 입력해주세요.");
        }
        if (isBlank(request.modelName())) {
            return ValidationResult.failure("사용할 모델을 선택해주세요.");
        }

        try {
            switch (request.provider()) {
                case OPENAI -> validateOpenAi(request);
                case CLAUDE -> validateClaude(request);
                case GEMINI -> validateGemini(request);
            }
            return ValidationResult.success("AI 인증 정보가 확인되었습니다.");
        } catch (HttpStatusCodeException e) {
            return ValidationResult.failure(providerLabel(request.provider()) + " 인증이 거부되었습니다. (HTTP "
                    + e.getStatusCode().value() + ")" + providerErrorMessage(e));
        } catch (ResourceAccessException e) {
            return ValidationResult.failure(providerLabel(request.provider()) + " 서버에 연결할 수 없습니다.");
        } catch (Exception e) {
            return ValidationResult.failure(providerLabel(request.provider()) + " 인증 정보를 확인할 수 없습니다.");
        }
    }

    @Transactional
    public AiProviderSettingDto.Response save(Long companyId, AiProviderSettingDto.SaveRequest request) {
        ValidationResult validation = validate(request.toValidateRequest());
        if (!validation.success()) {
            throw new CustomException(400, validation.message());
        }

        AiProviderSetting setting = repository.findByCompanyIdAndProvider(companyId, request.provider())
                .orElse(new AiProviderSetting(companyId, request.provider()));
        setting.setDisplayName(firstText(request.displayName(), defaultDisplayName(request.provider())));
        setting.setModelName(request.modelName().trim());
        setting.setApiKey(request.apiKey().trim());
        setting.setOrganizationId(trimToNull(request.organizationId()));
        setting.setProjectId(trimToNull(request.projectId()));
        setting.setValidatedAt(LocalDateTime.now());
        setting.setIsActive(true);

        return AiProviderSettingDto.Response.from(repository.save(setting));
    }

    private void validateOpenAi(AiProviderSettingDto.ValidateRequest request) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(request.apiKey().trim());
        if (!isBlank(request.organizationId())) {
            headers.set("OpenAI-Organization", request.organizationId().trim());
        }
        if (!isBlank(request.projectId())) {
            headers.set("OpenAI-Project", request.projectId().trim());
        }
        restTemplate.exchange(OPENAI_MODELS_URL, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    }

    private void validateClaude(AiProviderSettingDto.ValidateRequest request) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", request.apiKey().trim());
        headers.set("anthropic-version", CLAUDE_API_VERSION);
        restTemplate.exchange(CLAUDE_MODELS_URL, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    }

    private void validateGemini(AiProviderSettingDto.ValidateRequest request) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-goog-api-key", request.apiKey().trim());
        restTemplate.exchange(GEMINI_MODELS_URL, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    }

    private String providerLabel(AiProvider provider) {
        return switch (provider) {
            case OPENAI -> "OpenAI";
            case CLAUDE -> "Claude";
            case GEMINI -> "Gemini";
        };
    }

    private String defaultDisplayName(AiProvider provider) {
        return providerLabel(provider) + " 기본";
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

    private String firstText(String... values) {
        for (String value : values) {
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return "";
    }

    private String trimToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
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
