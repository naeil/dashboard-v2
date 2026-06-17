package naeil.dashboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.entity.AiProviderSetting;
import naeil.dashboard.enums.AiProvider;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AiApiClient {

    private static final String OPENAI_URL = "https://api.openai.com/v1/chat/completions";
    private static final String CLAUDE_URL = "https://api.anthropic.com/v1/messages";
    private static final String CLAUDE_API_VERSION = "2023-06-01";
    private static final String GEMINI_URL_PREFIX = "https://generativelanguage.googleapis.com/v1beta/models/";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    public String complete(AiProviderSetting setting, String model, String systemPrompt, String userMessage) {
        if (setting == null || setting.getProvider() == null) {
            throw new CustomException(400, "AI 인증 정보를 선택해주세요.");
        }
        if (setting.getApiKey() == null || setting.getApiKey().isBlank()) {
            throw new CustomException(400, "선택한 AI 인증 정보에 API Key가 없습니다.");
        }
        if (model == null || model.isBlank()) {
            throw new CustomException(400, "AI 모델을 선택해주세요.");
        }

        return switch (setting.getProvider()) {
            case OPENAI -> completeOpenAi(setting, model.trim(), systemPrompt, userMessage);
            case CLAUDE -> completeClaude(setting, model.trim(), systemPrompt, userMessage);
            case GEMINI -> completeGemini(setting, model.trim(), systemPrompt, userMessage);
        };
    }

    private String completeOpenAi(AiProviderSetting setting, String model, String systemPrompt, String userMessage) {
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "max_tokens", 4096,
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userMessage)
                    )
            );

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(OPENAI_URL))
                    .timeout(Duration.ofSeconds(120))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + setting.getApiKey().trim())
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));

            if (setting.getOrganizationId() != null && !setting.getOrganizationId().isBlank()) {
                builder.header("OpenAI-Organization", setting.getOrganizationId().trim());
            }
            if (setting.getProjectId() != null && !setting.getProjectId().isBlank()) {
                builder.header("OpenAI-Project", setting.getProjectId().trim());
            }

            JsonNode root = sendJson(builder.build(), "OpenAI");
            return root.path("choices").path(0).path("message").path("content").asText();
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            throw new CustomException(500, "OpenAI 호출 실패: " + e.getMessage());
        }
    }

    private String completeClaude(AiProviderSetting setting, String model, String systemPrompt, String userMessage) {
        try {
            Map<String, Object> body = Map.of(
                    "model", model,
                    "max_tokens", 4096,
                    "system", systemPrompt,
                    "messages", List.of(Map.of("role", "user", "content", userMessage))
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(CLAUDE_URL))
                    .timeout(Duration.ofSeconds(120))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", setting.getApiKey().trim())
                    .header("anthropic-version", CLAUDE_API_VERSION)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            JsonNode root = sendJson(request, "Claude");
            return root.path("content").path(0).path("text").asText();
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            throw new CustomException(500, "Claude 호출 실패: " + e.getMessage());
        }
    }

    private String completeGemini(AiProviderSetting setting, String model, String systemPrompt, String userMessage) {
        try {
            Map<String, Object> body = Map.of(
                    "system_instruction", Map.of(
                            "parts", List.of(Map.of("text", systemPrompt))
                    ),
                    "contents", List.of(Map.of(
                            "role", "user",
                            "parts", List.of(Map.of("text", userMessage))
                    )),
                    "generationConfig", Map.of("maxOutputTokens", 4096)
            );

            String encodedModel = URLEncoder.encode(model, StandardCharsets.UTF_8).replace("+", "%20");
            URI uri = URI.create(GEMINI_URL_PREFIX + encodedModel + ":generateContent");
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(uri)
                    .timeout(Duration.ofSeconds(120))
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", setting.getApiKey().trim())
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            JsonNode root = sendJson(request, "Gemini");
            return root.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText();
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            throw new CustomException(500, "Gemini 호출 실패: " + e.getMessage());
        }
    }

    private JsonNode sendJson(HttpRequest request, String providerLabel) throws Exception {
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new CustomException(500, providerLabel + " API 오류: " + response.statusCode() + " " + trimBody(response.body()));
        }
        return objectMapper.readTree(response.body());
    }

    private String trimBody(String body) {
        if (body == null || body.isBlank()) {
            return "";
        }
        String compact = body.replaceAll("\\s+", " ").trim();
        return compact.length() > 500 ? compact.substring(0, 500) + "..." : compact;
    }
}
