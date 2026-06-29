package naeil.dashboard.service.ai;

import java.util.List;
import naeil.dashboard.dto.AiProviderSettingDto;
import naeil.dashboard.entity.AiProviderSetting;
import naeil.dashboard.enums.AiProvider;

public interface AiModelCatalogProvider {

    AiProvider provider();

    void validate(AiProviderSettingDto.ValidateRequest request);

    List<AiProviderSettingDto.ModelOption> fetchModels(AiProviderSetting setting);
}
