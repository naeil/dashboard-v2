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
public class ClaudeModelCatalogProvider implements AiModelCatalogProvider {

    private static final String CLAUDE_MODELS_URL = "https://api.anthropic.com/v1/models";
    private static final String CLAUDE_API_VERSION = "2023-06-01";

    private final RestTemplate restTemplate;

    public ClaudeModelCatalogProvider(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Override
    public AiProvider provider() {
        return AiProvider.CLAUDE;
    }

    @Override
    public void validate(AiProviderSettingDto.ValidateRequest request) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", request.apiKey().trim());
        headers.set("anthropic-version", CLAUDE_API_VERSION);
        restTemplate.exchange(CLAUDE_MODELS_URL, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    }

    @Override
    public List<AiProviderSettingDto.ModelOption> fetchModels(AiProviderSetting setting) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", setting.getApiKey().trim());
        headers.set("anthropic-version", CLAUDE_API_VERSION);

        Map<?, ?> body = restTemplate.exchange(
                CLAUDE_MODELS_URL,
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
                    if (isBlank(id)) {
                        continue;
                    }
                    models.add(new AiProviderSettingDto.ModelOption(id, firstText(text(model.get("display_name")), id)));
                }
            }
        }
        return sort(models);
    }

    private List<AiProviderSettingDto.ModelOption> sort(List<AiProviderSettingDto.ModelOption> models) {
        return models.stream()
                .distinct()
                .sorted(Comparator.comparing(AiProviderSettingDto.ModelOption::label, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private String firstText(String... values) {
        for (String value : values) {
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return "";
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
