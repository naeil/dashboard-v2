package naeil.dashboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.BlogGenerateRequest;
import naeil.dashboard.dto.BlogGenerateResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
@RequiredArgsConstructor
public class BlogService {

    private final ClaudeApiClient claudeApiClient;
    private final NaverBlogPublisher naverBlogPublisher;
    private final ObjectMapper objectMapper;

    private static final String SYSTEM_PROMPT = """
            당신은 한국의 유통/브랜드 사업을 운영하는 회사의 마케팅 전문가입니다.
            네이버 블로그에 올릴 마케팅 콘텐츠를 작성합니다.

            다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
            {
              "title": "블로그 제목",
              "content": "본문 내용 (마크다운 사용 가능, 최소 500자)",
              "hashtags": "#태그1 #태그2 #태그3 #태그4 #태그5"
            }

            작성 규칙:
            - 제목은 클릭을 유도하는 SEO 최적화 제목
            - 본문은 서론-본론-결론 구조
            - 자연스러운 한국어, 친근하지만 신뢰감 있는 톤
            - 해시태그는 5~10개, 검색 최적화
            """;

    public BlogGenerateResponse generate(BlogGenerateRequest request) {
        String userMessage = buildUserMessage(request);
        String rawResponse = claudeApiClient.complete(SYSTEM_PROMPT, userMessage);

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
            log.error("GPT 응답 파싱 실패: {}", rawResponse, e);
            throw new CustomException(500, "AI 응답 파싱에 실패했습니다.");
        }
    }

    public Map<String, String> publish(
            String title, String content, String hashtags,
            String naverUsername, String naverPassword,
            List<MultipartFile> images, List<MultipartFile> videos
    ) {
        naverBlogPublisher.publish(title, content, hashtags, naverUsername, naverPassword, images, videos);
        return Map.of("message", "네이버 블로그에 발행되었습니다.");
    }

    private String buildUserMessage(BlogGenerateRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("주제: ").append(request.topic()).append("\n");
        if (request.keywords() != null && !request.keywords().isBlank()) {
            sb.append("포함할 키워드: ").append(request.keywords()).append("\n");
        }
        if (request.category() != null && !request.category().isBlank()) {
            sb.append("카테고리: ").append(request.category()).append("\n");
        }
        if (request.tone() != null && !request.tone().isBlank()) {
            sb.append("톤앤매너: ").append(request.tone()).append("\n");
        }
        String lengthGuide = switch (request.length() == null ? "medium" : request.length()) {
            case "short" -> "500~800자";
            case "long" -> "1500자 이상";
            default -> "800~1200자";
        };
        sb.append("본문 길이: ").append(lengthGuide);
        return sb.toString();
    }
}
