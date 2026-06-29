package naeil.dashboard.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AiProviderSettingDto;
import naeil.dashboard.entity.AiProviderSetting;
import naeil.dashboard.enums.AiProvider;
import naeil.dashboard.repository.AiProviderSettingRepository;
import naeil.dashboard.service.ai.AiModelCatalogProvider;
import naeil.dashboard.service.ai.AiModelCatalogService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;

@Service
@Transactional(readOnly = true)
public class AiProviderSettingService {

    private static final String CLAUDE_API_VERSION = "2023-06-01";

    private final AiProviderSettingRepository repository;
    private final AiModelCatalogService modelCatalogService;
    private final Map<AiProvider, AiModelCatalogProvider> modelProviders;

    public AiProviderSettingService(
            AiProviderSettingRepository repository,
            AiModelCatalogService modelCatalogService,
            List<AiModelCatalogProvider> modelProviders
    ) {
        this.repository = repository;
        this.modelCatalogService = modelCatalogService;
        this.modelProviders = modelProviders.stream()
                .collect(Collectors.toMap(AiModelCatalogProvider::provider, provider -> provider));
    }

    public List<AiProviderSettingDto.ProviderConfig> getProviderConfigs() {
        return List.of(
                new AiProviderSettingDto.ProviderConfig(
                        AiProvider.OPENAI,
                        "OpenAI",
                        "OpenAI API Key로 OpenAI API를 연결합니다.",
                        List.of("apiKey"),
                        List.of("organizationId", "projectId"),
                        null
                ),
                new AiProviderSettingDto.ProviderConfig(
                        AiProvider.CLAUDE,
                        "Claude",
                        "Anthropic API Key로 Claude API를 연결합니다.",
                        List.of("apiKey"),
                        List.of(),
                        CLAUDE_API_VERSION
                ),
                new AiProviderSettingDto.ProviderConfig(
                        AiProvider.GEMINI,
                        "Gemini",
                        "Google AI Studio API Key로 Gemini API를 연결합니다.",
                        List.of("apiKey"),
                        List.of(),
                        null
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
        AiModelCatalogProvider catalogProvider = modelProviders.get(request.provider());
        if (catalogProvider == null) {
            return ValidationResult.failure("지원하지 않는 AI 제공사입니다.");
        }
        try {
            catalogProvider.validate(request);
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

    public List<AiProviderSettingDto.ModelOption> getModels(Long companyId, AiProvider provider) {
        if (provider == null) {
            throw new CustomException(400, "AI 제공사를 선택해주세요.");
        }

        AiProviderSetting setting = loadValidatedSetting(companyId, provider);
        AiModelCatalogProvider catalogProvider = modelProviders.get(provider);
        if (catalogProvider == null) {
            throw new CustomException(500, providerLabel(provider) + " 모델 조회 구현이 없습니다.");
        }

        try {
            return modelCatalogService.getModels(setting, () -> fetchAndStampModels(setting, catalogProvider));
        } catch (HttpStatusCodeException e) {
            throw new CustomException(
                    e.getStatusCode().value(),
                    providerLabel(provider) + " 모델 목록 조회 실패" + providerErrorMessage(e)
            );
        } catch (ResourceAccessException e) {
            throw new CustomException(502, providerLabel(provider) + " 서버에 연결할 수 없습니다.");
        } catch (Exception e) {
            throw new CustomException(500, providerLabel(provider) + " 모델 목록을 조회할 수 없습니다.");
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
        setting.setApiKey(request.apiKey().trim());
        setting.setOrganizationId(trimToNull(request.organizationId()));
        setting.setProjectId(trimToNull(request.projectId()));
        setting.setValidatedAt(LocalDateTime.now());
        setting.setIsActive(true);

        AiProviderSetting saved = repository.save(setting);
        AiModelCatalogProvider catalogProvider = modelProviders.get(saved.getProvider());
        if (catalogProvider != null) {
            modelCatalogService.getModels(saved, () -> fetchAndStampModels(saved, catalogProvider));
        }
        return AiProviderSettingDto.Response.from(saved);
    }

    public void refreshValidatedModelCatalogs() {
        repository.findByValidatedAtIsNotNullAndIsActiveTrueOrderByCompanyIdAscProviderAsc()
                .stream()
                .filter(setting -> !isBlank(setting.getApiKey()))
                .forEach(setting -> {
                    AiModelCatalogProvider catalogProvider = modelProviders.get(setting.getProvider());
                    if (catalogProvider != null) {
                        modelCatalogService.warmUpAsync(setting, () -> fetchAndStampModels(setting, catalogProvider));
                    }
                });
    }

    private AiProviderSetting loadValidatedSetting(Long companyId, AiProvider provider) {
        AiProviderSetting setting = repository.findByCompanyIdAndProvider(companyId, provider)
                .orElseThrow(() -> new CustomException(404, "저장된 AI 인증 정보가 없습니다."));
        if (Boolean.FALSE.equals(setting.getIsActive()) || setting.getValidatedAt() == null) {
            throw new CustomException(400, "검증 완료된 AI 인증 정보가 없습니다.");
        }
        if (isBlank(setting.getApiKey())) {
            throw new CustomException(400, "저장된 API Key가 없습니다.");
        }
        return setting;
    }

    private List<AiProviderSettingDto.ModelOption> fetchAndStampModels(
            AiProviderSetting setting,
            AiModelCatalogProvider catalogProvider
    ) {
        List<AiProviderSettingDto.ModelOption> models = catalogProvider.fetchModels(setting);
        setting.setLastModelSyncedAt(LocalDateTime.now());
        repository.save(setting);
        return models;
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
