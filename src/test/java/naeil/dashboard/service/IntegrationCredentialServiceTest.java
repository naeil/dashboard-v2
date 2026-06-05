package naeil.dashboard.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.util.Optional;
import naeil.dashboard.entity.IntegrationSetting;
import naeil.dashboard.enums.IntegrationType;
import naeil.dashboard.repository.IntegrationSettingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.core.env.Environment;

@ExtendWith(MockitoExtension.class)
class IntegrationCredentialServiceTest {

    private static final Long COMPANY_ID = 1L;

    @Mock
    private IntegrationSettingRepository settingRepository;

    @Mock
    private Environment environment;

    private IntegrationCredentialService credentialService;

    @BeforeEach
    void setUp() {
        credentialService = new IntegrationCredentialService(settingRepository, environment);
    }

    @Test
    void naverSearchCredentialsPreferSavedSettingOverEnvironment() {
        IntegrationSetting setting = new IntegrationSetting(COMPANY_ID, IntegrationType.NAVER_SEARCH);
        setting.setApiKey("saved-client-id");
        setting.setApiPassword("saved-client-secret");
        when(settingRepository.findByCompanyIdAndIntegrationType(COMPANY_ID, IntegrationType.NAVER_SEARCH))
                .thenReturn(Optional.of(setting));
        when(environment.getProperty("naver.client-id", "")).thenReturn("env-client-id");
        when(environment.getProperty("naver.client-secret", "")).thenReturn("env-client-secret");

        IntegrationCredentialService.NaverSearchCredentials credentials =
                credentialService.getNaverSearchCredentials(COMPANY_ID);

        assertThat(credentials.clientId()).isEqualTo("saved-client-id");
        assertThat(credentials.clientSecret()).isEqualTo("saved-client-secret");
    }

    @Test
    void metaAdsCredentialsFallbackToEnvironmentWhenNoSavedSettingExists() {
        when(settingRepository.findByCompanyIdAndIntegrationType(COMPANY_ID, IntegrationType.META_ADS))
                .thenReturn(Optional.empty());
        when(environment.getProperty("meta.access-token", "")).thenReturn("env-meta-token");
        when(environment.getProperty("meta.ad-account-id", "")).thenReturn("env-meta-account");

        IntegrationCredentialService.MetaAdsCredentials credentials =
                credentialService.getMetaAdsCredentials(COMPANY_ID);

        assertThat(credentials.accessToken()).isEqualTo("env-meta-token");
        assertThat(credentials.adAccountId()).isEqualTo("env-meta-account");
    }
}
