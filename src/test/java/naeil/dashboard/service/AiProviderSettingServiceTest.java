package naeil.dashboard.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import naeil.dashboard.dto.AiProviderSettingDto;
import naeil.dashboard.entity.AiProviderSetting;
import naeil.dashboard.enums.AiProvider;
import naeil.dashboard.repository.AiProviderSettingRepository;
import naeil.dashboard.service.ai.AiModelCatalogProvider;
import naeil.dashboard.service.ai.AiModelCatalogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AiProviderSettingServiceTest {

    @Mock
    private AiProviderSettingRepository repository;

    @Mock
    private AiModelCatalogService modelCatalogService;

    private AiProviderSettingService service;

    @BeforeEach
    void setUp() {
        service = new AiProviderSettingService(
                repository,
                modelCatalogService,
                List.of(new FakeProvider(AiProvider.GEMINI), new FakeProvider(AiProvider.OPENAI))
        );
    }

    @Test
    void getModelsUsesMatchingProviderImplementation() {
        AiProviderSetting setting = new AiProviderSetting(1L, AiProvider.GEMINI);
        setting.setApiKey("test-key");
        setting.setIsActive(true);
        setting.setValidatedAt(LocalDateTime.now());
        when(repository.findByCompanyIdAndProvider(1L, AiProvider.GEMINI)).thenReturn(Optional.of(setting));

        List<AiProviderSettingDto.ModelOption> models = service.getModels(1L, AiProvider.GEMINI);

        assertThat(models)
                .extracting(AiProviderSettingDto.ModelOption::value)
                .containsExactly("gemini-model");
    }

    @Test
    void validateUsesMatchingProviderImplementation() {
        AiProviderSettingDto.ValidateRequest request =
                new AiProviderSettingDto.ValidateRequest(AiProvider.OPENAI, "test-key", null, null);

        AiProviderSettingService.ValidationResult result = service.validate(request);

        assertThat(result.success()).isTrue();
    }

    @Test
    void saveWarmsModelCacheAfterPersistingCredential() {
        AiProviderSetting setting = new AiProviderSetting(1L, AiProvider.GEMINI);
        setting.setApiKey("test-key");
        setting.setDisplayName("Gemini 기본");
        setting.setIsActive(true);
        setting.setValidatedAt(LocalDateTime.now());
        when(repository.findByCompanyIdAndProvider(1L, AiProvider.GEMINI)).thenReturn(Optional.of(setting));
        when(repository.save(any(AiProviderSetting.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AiProviderSettingDto.SaveRequest request =
                new AiProviderSettingDto.SaveRequest(AiProvider.GEMINI, "Gemini 기본", "test-key", null, null);

        service.save(1L, request);

        verify(modelCatalogService).getModels(any(AiProviderSetting.class), any());
    }

    @Test
    void getSettingsIncludesLastModelSyncedAt() {
        AiProviderSetting setting = new AiProviderSetting(1L, AiProvider.GEMINI);
        setting.setApiKey("test-key");
        setting.setDisplayName("Gemini 기본");
        setting.setIsActive(true);
        setting.setValidatedAt(LocalDateTime.now());
        setting.setLastModelSyncedAt(LocalDateTime.of(2026, 6, 19, 14, 0));
        when(repository.findByCompanyIdOrderByProviderAsc(1L)).thenReturn(List.of(setting));

        List<AiProviderSettingDto.Response> responses = service.getSettings(1L);

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).lastModelSyncedAt()).isEqualTo(LocalDateTime.of(2026, 6, 19, 14, 0));
    }

    @Test
    void refreshValidatedModelCatalogsWarmsAllValidatedActiveSettings() {
        AiProviderSetting gemini = new AiProviderSetting(1L, AiProvider.GEMINI);
        gemini.setApiKey("gemini-key");
        gemini.setIsActive(true);
        gemini.setValidatedAt(LocalDateTime.now());

        AiProviderSetting openAi = new AiProviderSetting(1L, AiProvider.OPENAI);
        openAi.setApiKey("openai-key");
        openAi.setIsActive(true);
        openAi.setValidatedAt(LocalDateTime.now());

        when(repository.findByValidatedAtIsNotNullAndIsActiveTrueOrderByCompanyIdAscProviderAsc())
                .thenReturn(List.of(gemini, openAi));

        service.refreshValidatedModelCatalogs();

        verify(modelCatalogService, times(2)).warmUpAsync(any(AiProviderSetting.class), any());
    }

    private static final class FakeProvider implements AiModelCatalogProvider {
        private final AiProvider provider;

        private FakeProvider(AiProvider provider) {
            this.provider = provider;
        }

        @Override
        public AiProvider provider() {
            return provider;
        }

        @Override
        public void validate(AiProviderSettingDto.ValidateRequest request) {
            if (request.provider() != provider) {
                throw new IllegalArgumentException("provider mismatch");
            }
        }

        @Override
        public List<AiProviderSettingDto.ModelOption> fetchModels(AiProviderSetting setting) {
            return List.of(new AiProviderSettingDto.ModelOption(provider.name().toLowerCase() + "-model", provider.name()));
        }
    }
}
