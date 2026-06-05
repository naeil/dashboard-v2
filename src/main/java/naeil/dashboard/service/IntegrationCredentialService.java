package naeil.dashboard.service;

import java.time.LocalDateTime;
import naeil.dashboard.entity.IntegrationSetting;
import naeil.dashboard.enums.IntegrationType;
import naeil.dashboard.repository.IntegrationSettingRepository;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class IntegrationCredentialService {

    private final IntegrationSettingRepository settingRepository;
    private final Environment environment;

    public IntegrationCredentialService(IntegrationSettingRepository settingRepository, Environment environment) {
        this.settingRepository = settingRepository;
        this.environment = environment;
    }

    public NaverSearchCredentials getNaverSearchCredentials(Long companyId) {
        IntegrationSetting setting = find(companyId, IntegrationType.NAVER_SEARCH);
        return new NaverSearchCredentials(
                firstText(value(setting, CredentialField.API_KEY), env("naver.client-id")),
                firstText(value(setting, CredentialField.PASSWORD), env("naver.client-secret"))
        );
    }

    public NaverBlogCredentials getNaverBlogCredentials(Long companyId) {
        IntegrationSetting setting = find(companyId, IntegrationType.NAVER_BLOG);
        return new NaverBlogCredentials(
                firstText(value(setting, CredentialField.API_KEY), env("naver-blog.client-id")),
                firstText(value(setting, CredentialField.PASSWORD), env("naver-blog.client-secret")),
                firstText(value(setting, CredentialField.EMAIL), env("naver-blog.access-token")),
                firstText(value(setting, CredentialField.EXTRA), env("naver-blog.default-blog-id"))
        );
    }

    public NaverAdCredentials getNaverAdCredentials(Long companyId) {
        IntegrationSetting setting = find(companyId, IntegrationType.NAVER_AD);
        return new NaverAdCredentials(
                firstText(value(setting, CredentialField.API_KEY), env("naver-ad.customer-id")),
                firstText(value(setting, CredentialField.EMAIL), env("naver-ad.access-license")),
                firstText(value(setting, CredentialField.PASSWORD), env("naver-ad.secret-key"))
        );
    }

    public MetaAdsCredentials getMetaAdsCredentials(Long companyId) {
        IntegrationSetting setting = find(companyId, IntegrationType.META_ADS);
        return new MetaAdsCredentials(
                firstText(value(setting, CredentialField.API_KEY), env("meta.access-token")),
                firstText(value(setting, CredentialField.EMAIL), env("meta.ad-account-id"))
        );
    }

    public DaouMailCredentials getDaouMailCredentials(Long companyId) {
        IntegrationSetting setting = find(companyId, IntegrationType.DAOU_MAIL);
        return new DaouMailCredentials(
                firstText(value(setting, CredentialField.API_KEY), env("daou.mail.host"), "imap.daouoffice.com"),
                firstText(value(setting, CredentialField.EMAIL), env("daou.mail.username")),
                firstText(value(setting, CredentialField.PASSWORD), env("daou.mail.password"))
        );
    }

    @Transactional
    public DaouMailCredentials saveDaouMailCredentials(Long companyId, String host, String username, String password) {
        IntegrationSetting setting = settingRepository.findByCompanyIdAndIntegrationType(companyId, IntegrationType.DAOU_MAIL)
                .orElse(new IntegrationSetting(companyId, IntegrationType.DAOU_MAIL));
        setting.setApiKey(firstText(host, "imap.daouoffice.com"));
        setting.setApiEmail(username);
        setting.setApiPassword(password);
        setting.setAuthUpdatedAt(LocalDateTime.now());
        IntegrationSetting saved = settingRepository.save(setting);
        return new DaouMailCredentials(saved.getApiKey(), saved.getApiEmail(), saved.getApiPassword());
    }

    private IntegrationSetting find(Long companyId, IntegrationType integrationType) {
        return settingRepository.findByCompanyIdAndIntegrationType(companyId, integrationType).orElse(null);
    }

    private String env(String key) {
        return environment.getProperty(key, "");
    }

    private String value(IntegrationSetting setting, CredentialField field) {
        if (setting == null) {
            return "";
        }
        return switch (field) {
            case API_KEY -> setting.getApiKey();
            case EMAIL -> setting.getApiEmail();
            case PASSWORD -> setting.getApiPassword();
            case EXTRA -> setting.getApiExtra();
        };
    }

    private String firstText(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return "";
    }

    private enum CredentialField {
        API_KEY,
        EMAIL,
        PASSWORD,
        EXTRA
    }

    public record NaverSearchCredentials(String clientId, String clientSecret) {}
    public record NaverBlogCredentials(String clientId, String clientSecret, String accessToken, String blogId) {}
    public record NaverAdCredentials(String customerId, String accessLicense, String secretKey) {}
    public record MetaAdsCredentials(String accessToken, String adAccountId) {}
    public record DaouMailCredentials(String host, String username, String password) {}
}
