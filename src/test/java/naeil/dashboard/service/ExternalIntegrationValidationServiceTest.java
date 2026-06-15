package naeil.dashboard.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withUnauthorizedRequest;

import naeil.dashboard.common.api.PlayAutoApiClient;
import naeil.dashboard.dto.IntegrationSettingDto;
import naeil.dashboard.enums.IntegrationType;
import naeil.dashboard.repository.CollectionExecutionHistoryRepository;
import naeil.dashboard.repository.IntegrationSettingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

class ExternalIntegrationValidationServiceTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer server;
    private ExternalIntegrationValidationService validationService;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        server = MockRestServiceServer.bindTo(restTemplate).build();
        validationService = new ExternalIntegrationValidationService(restTemplate);
    }

    @Test
    void naverSearchRejectsMissingClientSecret() {
        IntegrationSettingDto.ValidateRequest request = request(IntegrationType.NAVER_SEARCH);
        request.setApiKey("client-id");

        assertThat(validationService.validate(request)).isFalse();
    }

    @Test
    void naverSearchValidatesWithReadOnlySearchRequest() {
        server.expect(requestTo("https://openapi.naver.com/v1/search/blog.json?query=NAEIL&display=1"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("X-Naver-Client-Id", "client-id"))
                .andExpect(header("X-Naver-Client-Secret", "client-secret"))
                .andRespond(withSuccess("{\"total\":0,\"items\":[]}", MediaType.APPLICATION_JSON));

        IntegrationSettingDto.ValidateRequest request = request(IntegrationType.NAVER_SEARCH);
        request.setApiKey("client-id");
        request.setPassword("client-secret");

        assertThat(validationService.validate(request)).isTrue();
        server.verify();
    }

    @Test
    void naverBlogReportsThatTheOfficialPublishingApiIsUnavailable() {
        IntegrationSettingDto.ValidateRequest request = request(IntegrationType.NAVER_BLOG);
        request.setApiKey("client-id");
        request.setPassword("client-secret");
        request.setEmail("access-token");
        request.setExtraValue("blog-id");

        ExternalIntegrationValidationService.ValidationResult result = validationService.validateWithResult(request);

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("Blog writing API").contains("no longer available");
    }

    @Test
    void naverAdsValidatesByReadingCampaigns() {
        server.expect(requestTo("https://api.searchad.naver.com/ncc/campaigns"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("X-Timestamp", org.hamcrest.Matchers.not(org.hamcrest.Matchers.emptyString())))
                .andExpect(header("X-API-KEY", "access-license"))
                .andExpect(header("X-Customer", "2891496"))
                .andExpect(header("X-Signature", org.hamcrest.Matchers.not(org.hamcrest.Matchers.emptyString())))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        IntegrationSettingDto.ValidateRequest request = request(IntegrationType.NAVER_AD);
        request.setApiKey("2891496");
        request.setEmail("access-license");
        request.setPassword("secret-key");

        ExternalIntegrationValidationService.ValidationResult result = validationService.validateWithResult(request);

        assertThat(result.success()).isTrue();
        assertThat(result.message()).contains("Search Ad API").contains("valid");
        server.verify();
    }

    @Test
    void naverAdsFailureMessageIncludesProviderResponseBody() {
        server.expect(requestTo("https://api.searchad.naver.com/ncc/campaigns"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withBadRequest().body("{\"code\":400,\"message\":\"Invalid signature\"}"));

        IntegrationSettingDto.ValidateRequest request = request(IntegrationType.NAVER_AD);
        request.setApiKey("2891496");
        request.setEmail("access-license");
        request.setPassword("bad-secret");

        ExternalIntegrationValidationService.ValidationResult result = validationService.validateWithResult(request);

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("HTTP 400").contains("Invalid signature");
        server.verify();
    }

    @Test
    void metaAdsRejectsUnauthorizedCredential() {
        server.expect(requestTo("https://graph.facebook.com/act_123?fields=id%2Cname%2Caccount_status&access_token=bad-token"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withUnauthorizedRequest());

        IntegrationSettingDto.ValidateRequest request = request(IntegrationType.META_ADS);
        request.setApiKey("bad-token");
        request.setEmail("123");

        assertThat(validationService.validate(request)).isFalse();
        server.verify();
    }

    @Test
    void validationResultIncludesProviderFailureStatus() {
        server.expect(requestTo("https://openapi.naver.com/v1/search/blog.json?query=NAEIL&display=1"))
                .andRespond(withBadRequest());

        IntegrationSettingDto.ValidateRequest request = request(IntegrationType.NAVER_SEARCH);
        request.setApiKey("bad-client-id");
        request.setPassword("bad-client-secret");

        ExternalIntegrationValidationService.ValidationResult result = validationService.validateWithResult(request);

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("400").contains("validation");
        server.verify();
    }

    @Test
    void authSaveRejectsExternalCredentialsWhenValidationFails() {
        IntegrationSettingRepository settingRepository = mock(IntegrationSettingRepository.class);
        ExternalIntegrationValidationService externalValidator = mock(ExternalIntegrationValidationService.class);
        IntegrationSettingService settingService = new IntegrationSettingService(
                settingRepository,
                mock(CollectionExecutionHistoryRepository.class),
                mock(PlayAutoApiClient.class),
                externalValidator
        );
        IntegrationSettingDto.SaveAuthRequest request = new IntegrationSettingDto.SaveAuthRequest();
        request.setIntegrationType(IntegrationType.NAVER_SEARCH);
        request.setApiKey("client-id");
        request.setPassword("bad-secret");

        assertThatThrownBy(() -> settingService.saveAuthSetting(1L, request))
                .hasMessageContaining("validation");
        verify(settingRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    private IntegrationSettingDto.ValidateRequest request(IntegrationType integrationType) {
        IntegrationSettingDto.ValidateRequest request = new IntegrationSettingDto.ValidateRequest();
        request.setIntegrationType(integrationType);
        return request;
    }
}
