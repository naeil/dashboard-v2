package naeil.dashboard.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import naeil.dashboard.common.exception.CustomException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class MarketingAgentService {

    private static final String NAVER_BLOG_WRITE_URL = "https://openapi.naver.com/blog/writePost.json";
    private static final Long DEFAULT_COMPANY_ID = 1L;

    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final IntegrationCredentialService credentialService;

    public MarketingAgentService(
            ObjectMapper objectMapper,
            RestClient.Builder restClientBuilder,
            IntegrationCredentialService credentialService
    ) {
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder.build();
        this.credentialService = credentialService;
    }

    public Map<String, Object> createScenario(Map<String, Object> payload) {
        Map<String, Object> brief = mapValue(payload.get("brief"));
        String roleId = text(payload.get("roleId"), "blog");
        String roleName = roleName(roleId);
        String productName = text(brief.get("productName"), "제품명 미입력");
        String target = text(brief.get("target"), "핵심 타겟 미입력");
        String scenario = text(brief.get("scenario"), "상황 미입력");
        String concept = text(brief.get("concept"), "콘셉트 미입력");
        String desiredOutcome = text(brief.get("desiredOutcome"), "검색 노출과 구매 전환");
        String keywords = text(brief.get("keywords"), productName);
        String tone = text(brief.get("tone"), "신뢰감 있는 전문가 톤");
        String channel = text(brief.get("channel"), "네이버 블로그");
        String restrictions = text(brief.get("restrictions"), "과장 광고, 의학적 단정 표현, 근거 없는 수치 표현 금지");

        List<String> titleCandidates = titleCandidates(roleId, productName, target, keywords);
        List<String> scenarioSteps = List.of(
                "타겟이 검색하는 문제 상황을 첫 문단에서 명확히 짚습니다.",
                productName + "의 차별점과 신뢰 근거를 사례 중심으로 연결합니다.",
                "구매 전환 전에 필요한 불안 요소를 FAQ 또는 체크리스트로 해소합니다.",
                "상세페이지, 상담, 구매 버튼으로 이어지는 행동 문구를 배치합니다."
        );
        List<String> hooks = List.of(
                target + "이 지금 가장 많이 고민하는 지점을 제목에 반영",
                keywords + " 키워드를 제목, 첫 문단, 중간 소제목에 자연스럽게 배치",
                "비교, 후기, 사용 맥락, 체크리스트 중 하나를 메인 소재로 선택",
                "마지막 문단은 " + desiredOutcome + "로 연결"
        );
        String draft = buildDraft(roleId, productName, target, scenario, concept, desiredOutcome, keywords, tone, restrictions);
        String prompt = buildExecutionPrompt(roleName, productName, target, scenario, concept, desiredOutcome, keywords, tone, channel, restrictions);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "DRAFT_READY");
        response.put("executionMode", "LOCAL_SCENARIO_BUILDER");
        response.put("roleId", roleId);
        response.put("roleName", roleName);
        response.put("createdAt", LocalDateTime.now());
        response.put("titleCandidates", titleCandidates);
        response.put("scenarioSteps", scenarioSteps);
        response.put("viralHooks", hooks);
        response.put("draftTitle", titleCandidates.get(0));
        response.put("draftContent", draft);
        response.put("prompt", prompt);
        response.put("message", "시나리오 초안이 생성되었습니다. 제목과 본문을 검수한 뒤 네이버 블로그 배포를 실행하세요.");
        return response;
    }

    public Map<String, Object> deployNaverBlog(Map<String, Object> payload) {
        String title = text(payload.get("title"), "");
        String contents = text(payload.get("contents"), "");
        String categoryNo = text(payload.get("categoryNo"), "");
        IntegrationCredentialService.NaverBlogCredentials credentials =
                credentialService.getNaverBlogCredentials(DEFAULT_COMPANY_ID);
        String blogId = text(payload.get("blogId"), credentials.blogId());

        if (title.isBlank() || contents.isBlank()) {
            throw new CustomException(400, "블로그 제목과 본문을 입력해주세요.");
        }

        if (isBlank(credentials.accessToken()) || isBlank(credentials.clientId()) || isBlank(credentials.clientSecret())) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("configured", false);
            response.put("status", "CONFIG_REQUIRED");
            response.put("title", title);
            response.put("blogId", blogId);
            response.put("message", "네이버 블로그 자동 배포를 위해 NAVER_BLOG_CLIENT_ID, NAVER_BLOG_CLIENT_SECRET, NAVER_BLOG_ACCESS_TOKEN, NAVER_BLOG_ID 환경변수 설정이 필요합니다.");
            response.put("previewHtml", contents);
            return response;
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("title", title);
        form.add("contents", contents);
        if (!categoryNo.isBlank()) {
            form.add("categoryNo", categoryNo);
        }

        URI uri = UriComponentsBuilder.fromHttpUrl(NAVER_BLOG_WRITE_URL)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();

        try {
            String body = restClient.post()
                    .uri(uri)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + credentials.accessToken())
                    .header("X-Naver-Client-Id", credentials.clientId())
                    .header("X-Naver-Client-Secret", credentials.clientSecret())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(String.class);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("configured", true);
            response.put("status", "DEPLOYED");
            response.put("title", title);
            response.put("blogId", blogId);
            response.put("message", "네이버 블로그 배포 요청이 완료되었습니다.");
            response.put("raw", parseJsonOrText(body));
            return response;
        } catch (RestClientResponseException e) {
            throw new CustomException(e.getStatusCode().value(), "네이버 블로그 배포 실패: " + cleanError(e.getResponseBodyAsString(StandardCharsets.UTF_8)));
        } catch (RestClientException e) {
            throw new CustomException(502, "네이버 블로그 API 통신 실패: " + e.getMessage());
        }
    }

    private String buildDraft(
            String roleId,
            String productName,
            String target,
            String scenario,
            String concept,
            String desiredOutcome,
            String keywords,
            String tone,
            String restrictions
    ) {
        List<String> lines = new ArrayList<>();
        lines.add("## " + productName + " 콘텐츠 시나리오");
        lines.add("");
        lines.add("### 1. 검색 의도");
        lines.add(target + "이 `" + keywords + "`를 검색했을 때 가장 먼저 궁금해할 문제를 짚습니다.");
        lines.add("");
        lines.add("### 2. 도입 문단");
        lines.add(scenario + " 이 상황에서 독자가 바로 공감할 수 있는 질문으로 시작합니다.");
        lines.add("");
        lines.add("### 3. 핵심 메시지");
        lines.add(concept + " 관점에서 " + productName + "의 차별점, 사용 맥락, 신뢰 근거를 순서대로 설명합니다.");
        lines.add("");
        lines.add("### 4. 본문 구성");
        lines.add("- 문제 상황: 독자가 겪는 불편과 검색 이유");
        lines.add("- 해결 기준: 구매 전 확인해야 할 체크포인트");
        lines.add("- 제품 연결: " + productName + "이 그 기준을 충족하는 이유");
        lines.add("- 전환 장치: 후기, 비교, 사용 예시, FAQ");
        lines.add("");
        lines.add("### 5. CTA");
        lines.add(desiredOutcome + "가 자연스럽게 일어나도록 상세페이지, 상담, 구매 페이지로 안내합니다.");
        lines.add("");
        lines.add("### 6. 작성 톤");
        lines.add(tone);
        lines.add("");
        lines.add("### 7. 주의사항");
        lines.add(restrictions);
        if ("article".equals(roleId)) {
            lines.add("");
            lines.add("### 보도자료 추가 구조");
            lines.add("브랜드 배경, 대표 코멘트, 시장 의미, 출시 정보 순서로 기사형 문장을 구성합니다.");
        } else if ("viral".equals(roleId)) {
            lines.add("");
            lines.add("### 바이럴 소재 추가 구조");
            lines.add("후킹 문구 5개, 이미지 카피 3개, 댓글 유도 질문 3개를 함께 제작합니다.");
        }
        return String.join("\n", lines);
    }

    private String buildExecutionPrompt(
            String roleName,
            String productName,
            String target,
            String scenario,
            String concept,
            String desiredOutcome,
            String keywords,
            String tone,
            String channel,
            String restrictions
    ) {
        return """
                당신은 %s입니다.

                아래 입력값을 바탕으로 실제 배포 가능한 콘텐츠 초안을 작성하세요.

                - 제품/브랜드: %s
                - 타겟: %s
                - 시나리오: %s
                - 콘셉트: %s
                - 목표: %s
                - 핵심 키워드: %s
                - 채널: %s
                - 톤앤매너: %s
                - 금지/주의사항: %s

                출력 형식:
                1. 제목 후보 5개
                2. 검색 의도 분석
                3. 본문 초안
                4. CTA
                5. 해시태그
                """.formatted(roleName, productName, target, scenario, concept, desiredOutcome, keywords, channel, tone, restrictions);
    }

    private List<String> titleCandidates(String roleId, String productName, String target, String keywords) {
        if ("article".equals(roleId)) {
            return List.of(
                    productName + ", " + target + " 위한 브랜드 메시지 강화",
                    productName + " 출시 전략과 시장 경쟁력은?",
                    keywords + " 시장에서 주목받는 " + productName + "의 차별점"
            );
        }
        if ("viral".equals(roleId)) {
            return List.of(
                    target + "이 저장할 " + productName + " 체크포인트",
                    keywords + " 고민이라면 먼저 봐야 할 3가지",
                    productName + "을 써봐야 하는 현실적인 이유"
            );
        }
        return List.of(
                keywords + " 검색 전에 확인해야 할 " + productName + " 기준",
                target + "을 위한 " + productName + " 선택 가이드",
                productName + " 후기보다 먼저 봐야 할 핵심 체크리스트"
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    private Object parseJsonOrText(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        try {
            JsonNode node = objectMapper.readTree(value);
            return objectMapper.convertValue(node, Map.class);
        } catch (JsonProcessingException e) {
            return value;
        }
    }

    private String cleanError(String value) {
        if (value == null || value.isBlank()) {
            return "응답 내용 없음";
        }
        return value.length() > 500 ? value.substring(0, 500) : value;
    }

    private String roleName(String roleId) {
        return switch (roleId) {
            case "article" -> "기사 작성 AI";
            case "viral" -> "바이럴 소재 기획 AI";
            default -> "블로그 작성 AI";
        };
    }

    private String text(Object value, String fallback) {
        if (value == null) {
            return fallback;
        }
        String text = value.toString().trim();
        return text.isBlank() ? fallback : text;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
