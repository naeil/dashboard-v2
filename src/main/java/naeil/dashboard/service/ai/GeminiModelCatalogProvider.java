package naeil.dashboard.service.ai;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

@Component
public class GeminiModelCatalogProvider implements AiModelCatalogProvider {

    private static final String GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
    private static final String GEMINI_GENERATE_URL_PREFIX = "https://generativelanguage.googleapis.com/v1beta/models/";

    private final RestTemplate restTemplate;

    public GeminiModelCatalogProvider(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Override
    public AiProvider provider() {
        return AiProvider.GEMINI;
    }

    @Override
    public void validate(AiProviderSettingDto.ValidateRequest request) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-goog-api-key", request.apiKey().trim());
        restTemplate.exchange(GEMINI_MODELS_URL, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    }

    @Override
    public List<AiProviderSettingDto.ModelOption> fetchModels(AiProviderSetting setting) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-goog-api-key", setting.getApiKey().trim());

        Map<?, ?> body = restTemplate.exchange(
                GEMINI_MODELS_URL,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                Map.class
        ).getBody();

        Object data = body == null ? null : body.get("models");
        List<AiProviderSettingDto.ModelOption> candidates = new ArrayList<>();
        if (data instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> model && supportsGenerateContent(model.get("supportedGenerationMethods"))) {
                    String rawName = text(model.get("name"));
                    String id = rawName.startsWith("models/") ? rawName.substring("models/".length()) : rawName;
                    if (isBlank(id) || !isCandidateModel(id)) {
                        continue;
                    }
                    candidates.add(new AiProviderSettingDto.ModelOption(id, firstText(text(model.get("displayName")), id)));
                }
            }
        }

        return sort(candidates).stream()
                .parallel()
                .filter(model -> canUse(setting, model.value()))
                .sequential()
                .toList();
    }

    private boolean supportsGenerateContent(Object value) {
        if (!(value instanceof List<?> list)) {
            return false;
        }
        return list.stream().map(this::text).anyMatch("generateContent"::equals);
    }

    private boolean isCandidateModel(String id) {
        String normalized = id.toLowerCase();
        return normalized.startsWith("gemini-")
                && !normalized.contains("embedding")
                && !normalized.contains("image")
                && !normalized.contains("tts")
                && !normalized.contains("aqa")
                && !normalized.contains("learnlm")
                && !normalized.contains("robotics")
                && !normalized.contains("computer-use")
                && !normalized.contains("live");
    }

    private boolean canUse(AiProviderSetting setting, String model) {
        try {
            String encodedModel = URLEncoder.encode(model, StandardCharsets.UTF_8).replace("+", "%20");
            String uri = GEMINI_GENERATE_URL_PREFIX + encodedModel + ":generateContent";
            Map<String, Object> payload = Map.of(
                    "contents", List.of(Map.of(
                            "role", "user",
                            "parts", List.of(Map.of("text", "ping"))
                    )),
                    "generationConfig", Map.of("maxOutputTokens", 8)
            );
            HttpHeaders headers = new HttpHeaders();
            headers.set("x-goog-api-key", setting.getApiKey().trim());
            headers.set("Content-Type", "application/json");
            restTemplate.exchange(uri, HttpMethod.POST, new HttpEntity<>(payload, headers), Map.class);
            return true;
        } catch (HttpStatusCodeException | ResourceAccessException e) {
            return false;
        }
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
