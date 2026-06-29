package naeil.dashboard.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AiModelCatalogRefreshScheduler {

    private final AiProviderSettingService aiProviderSettingService;

    public AiModelCatalogRefreshScheduler(AiProviderSettingService aiProviderSettingService) {
        this.aiProviderSettingService = aiProviderSettingService;
    }

    @Scheduled(
            fixedDelayString = "${app.ai.model-catalog.refresh-ms:21600000}",
            initialDelayString = "${app.ai.model-catalog.initial-delay-ms:60000}"
    )
    public void refreshValidatedModelCatalogs() {
        aiProviderSettingService.refreshValidatedModelCatalogs();
    }
}
