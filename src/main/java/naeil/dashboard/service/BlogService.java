package naeil.dashboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.BlogGenerateRequest;
import naeil.dashboard.dto.BlogGenerateResponse;
import naeil.dashboard.entity.AiProviderSetting;
import naeil.dashboard.enums.AiProvider;
import naeil.dashboard.repository.AiProviderSettingRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
@RequiredArgsConstructor
public class BlogService {

    private static final Long DEFAULT_COMPANY_ID = 1L;

    private final AiApiClient aiApiClient;
    private final AiProviderSettingRepository aiProviderSettingRepository;
    private final NaverBlogPublisher naverBlogPublisher;
    private final ObjectMapper objectMapper;

    private static final String SYSTEM_PROMPT = """
            당신은 한국의 유통/브랜드 사업을 운영하는 회사의 마케팅 전문가 그리고 10년차 전문 카피라이터입니다.
            네이버 블로그에 올릴 마케팅 콘텐츠를 작성합니다.

            사용자가 제공하는 입력값을 다음 기준으로 반드시 반영하세요.
            - 주제: 글의 핵심 소재이며 제목과 본문 전체의 중심 맥락으로 사용합니다.
            - SEO 키워드: 제목, 본문, 해시태그에 자연스럽게 포함합니다.
            - 카테고리: 글의 방향성을 정합니다. 예를 들어 제품 소개는 제품의 사용 상황과 장점을 중심으로 작성합니다.
            - 톤앤매너: 문체와 표현 방식을 정합니다. 예를 들어 친근함은 쉬운 표현과 자연스러운 말투를 사용합니다.
            - 글 길이: 본문 분량의 기준으로 사용합니다.

            다음 JSON 형식으로만 응답하세요. JSON 외의 설명, 안내문, 코드블록은 절대 포함하지 마세요.

            JSON 형식 예시:
            {
              "title": "블로그 제목",
              "content": "본문 내용 (마크다운 사용 가능, 최소 500자)",
              "hashtags": "#태그1 #태그2 #태그3 #태그4 #태그5"
            }

            작성 규칙:
            - 제목은 클릭을 유도하는 SEO 최적화 제목으로 작성합니다.
            - 제목에는 사용자가 제공한 메인 키워드를 자연스럽게 포함합니다.
            - 본문은 서론-본론-결론 구조로 작성합니다.
            - 너무 노골적인 광고 문구보다 정보성 콘텐츠처럼 자연스럽게 작성합니다.
            - 제품의 장점은 사용자의 상황, 고민, 해결 방식과 연결해서 설명합니다.
            - 사용자가 제공하지 않은 수치, 인증, 후기, 판매량, 1위 표현은 지어내지 마세요.
            - "무조건", "완벽한", "최고의", "100%" 같은 과장 표현은 피하세요.
            - 마지막 문단에는 자연스러운 구매 유도 또는 브랜드 관심 유도 문장을 포함합니다.
            - 해시태그는 5~10개 작성하며, 메인 키워드와 관련 검색어를 포함합니다.
            - 응답은 반드시 유효한 JSON이어야 합니다.
            - JSON 문자열 안의 줄바꿈은 \\n으로 처리하세요.
            """;

    public BlogGenerateResponse generate(BlogGenerateRequest request) {
        String userMessage = buildUserMessage(request);
        AiProvider provider = resolveProvider(request.aiProvider());
        String model = requireModel(request.aiModel());
        AiProviderSetting setting = aiProviderSettingRepository
                .findByCompanyIdAndProvider(DEFAULT_COMPANY_ID, provider)
                .filter(item -> Boolean.TRUE.equals(item.getIsActive()))
                .orElseThrow(() -> new CustomException(400, providerLabel(provider) + " 인증 정보를 먼저 설정해주세요."));
        String rawResponse = aiApiClient.complete(setting, model, SYSTEM_PROMPT, userMessage);

        try {
            String json = rawResponse.trim();
            if (json.startsWith("```")) {
                json = json.replaceAll("^```(?:json)?\\s*", "").replaceAll("```\\s*$", "").trim();
            }

            Map<?, ?> parsed = objectMapper.readValue(json, Map.class);
            return new BlogGenerateResponse(
                    String.valueOf(parsed.get("title")),
                    String.valueOf(parsed.get("content")),
                    String.valueOf(parsed.get("hashtags"))
            );
        } catch (Exception e) {
            log.error("AI 응답 파싱 실패: {}", rawResponse, e);
            throw new CustomException(500, "AI 응답 파싱에 실패했습니다.");
        }
    }

    public Map<String, String> publish(
            String title, String content, String hashtags,
            String naverUsername, String naverPassword,
            List<MultipartFile> images, List<MultipartFile> videos
    ) {
        naverBlogPublisher.publish(title, content, hashtags, naverUsername, naverPassword, images, videos);
        return Map.of("message", "네이버 블로그에 발행했습니다.");
    }

    private String buildUserMessage(BlogGenerateRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("주제: ").append(request.topic()).append("\n");
        if (request.keywords() != null && !request.keywords().isBlank()) {
            sb.append("SEO 키워드: ").append(request.keywords()).append("\n");
        }
        if (request.category() != null && !request.category().isBlank()) {
            sb.append("카테고리: ").append(categoryLabel(request.category())).append("\n");
        }
        if (request.tone() != null && !request.tone().isBlank()) {
            sb.append("톤앤매너: ").append(toneLabel(request.tone())).append("\n");
        }
        String lengthGuide = switch (request.length() == null ? "medium" : request.length()) {
            case "short" -> "500~800자";
            case "long" -> "1500자 이상";
            default -> "800~1200자";
        };
        sb.append("글 길이: ").append(lengthGuide);
        return sb.toString();
    }

    private String categoryLabel(String value) {
        return switch (value == null ? "" : value.trim()) {
            case "product" -> "제품 소개";
            case "promotion" -> "프로모션";
            case "brand" -> "브랜드 스토리";
            case "guide" -> "구매 가이드";
            default -> value.trim();
        };
    }

    private String toneLabel(String value) {
        return switch (value == null ? "" : value.trim()) {
            case "friendly" -> "친근함";
            case "professional" -> "전문적";
            case "emotional" -> "감성적";
            case "informative" -> "정보형";
            default -> value.trim();
        };
    }

    private AiProvider resolveProvider(String value) {
        if (value == null || value.isBlank()) {
            throw new CustomException(400, "AI 제공자를 선택해주세요.");
        }
        try {
            return AiProvider.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new CustomException(400, "지원하지 않는 AI 제공자입니다.");
        }
    }

    private String requireModel(String value) {
        if (value == null || value.isBlank()) {
            throw new CustomException(400, "AI 모델을 선택해주세요.");
        }
        return value.trim();
    }

    private String providerLabel(AiProvider provider) {
        return switch (provider) {
            case OPENAI -> "OpenAI";
            case CLAUDE -> "Claude";
            case GEMINI -> "Gemini";
        };
    }
}
