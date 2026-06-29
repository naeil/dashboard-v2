package naeil.dashboard.service.ai;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import naeil.dashboard.dto.AiProviderSettingDto;
import naeil.dashboard.entity.AiProviderSetting;
import naeil.dashboard.enums.AiProvider;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class OpenAiModelCatalogProvider implements AiModelCatalogProvider {

    private static final String OPENAI_MODELS_URL = "https://api.openai.com/v1/models";

    private final RestTemplate restTemplate;

    public OpenAiModelCatalogProvider(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Override
    public AiProvider provider() {
        return AiProvider.OPENAI;
    }

    @Override
    public void validate(AiProviderSettingDto.ValidateRequest request) {
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

    @Override
    public List<AiProviderSettingDto.ModelOption> fetchModels(AiProviderSetting setting) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(setting.getApiKey().trim());
        if (!isBlank(setting.getOrganizationId())) {
            headers.set("OpenAI-Organization", setting.getOrganizationId().trim());
        }
        if (!isBlank(setting.getProjectId())) {
            headers.set("OpenAI-Project", setting.getProjectId().trim());
        }

        Map<?, ?> body = restTemplate.exchange(
                OPENAI_MODELS_URL,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                Map.class
        ).getBody();

        Object data = body == null ? null : body.get("data");
        List<AiProviderSettingDto.ModelOption> models = new ArrayList<>();
        if (data instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> model) {
                    String id = text(model.get("id"));
                    if (isBlank(id) || !isChatModel(id)) {
                        continue;
                    }
                    models.add(new AiProviderSettingDto.ModelOption(id, id));
                }
            }
        }
        return sort(models);
    }

    private boolean isChatModel(String id) {
        String normalized = id.toLowerCase();
        return normalized.startsWith("gpt-")
                || normalized.startsWith("o1")
                || normalized.startsWith("o3")
                || normalized.startsWith("o4")
                || normalized.startsWith("chatgpt-");
    }

    private List<AiProviderSettingDto.ModelOption> sort(List<AiProviderSettingDto.ModelOption> models) {
        return models.stream()
                .distinct()
                .sorted(Comparator.comparing(AiProviderSettingDto.ModelOption::label, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
