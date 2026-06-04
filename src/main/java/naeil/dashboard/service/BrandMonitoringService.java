package naeil.dashboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.BrandMonitoringResultDto;
import naeil.dashboard.dto.BrandMonitoringSearchResponse;
import naeil.dashboard.dto.BrandMonitoringSummaryDto;
import naeil.dashboard.entity.BrandKeywordSearchLog;
import naeil.dashboard.repository.BrandKeywordSearchLogRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class BrandMonitoringService {

    private static final String NAVER_SEARCH_BASE_URL = "https://openapi.naver.com/v1/search";
    private static final int DISPLAY_COUNT = 10;

    private final BrandKeywordSearchLogRepository searchLogRepository;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final String naverClientId;
    private final String naverClientSecret;

    public BrandMonitoringService(
            BrandKeywordSearchLogRepository searchLogRepository,
            ObjectMapper objectMapper,
            RestClient.Builder restClientBuilder,
            @Value("${naver.client-id:}") String naverClientId,
            @Value("${naver.client-secret:}") String naverClientSecret
    ) {
        this.searchLogRepository = searchLogRepository;
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder.build();
        this.naverClientId = naverClientId;
        this.naverClientSecret = naverClientSecret;
    }

    @Transactional
    public BrandMonitoringSearchResponse search(String keyword) {
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        if (normalizedKeyword.isBlank()) {
            throw new CustomException(400, "검색 키워드를 입력해주세요.");
        }
        if (naverClientId == null || naverClientId.isBlank()
                || naverClientSecret == null || naverClientSecret.isBlank()) {
            throw new CustomException(400, "NAVER API 키가 설정되지 않았습니다");
        }

        LocalDateTime searchedAt = LocalDateTime.now();
        List<BrandMonitoringResultDto> results = new ArrayList<>();
        results.addAll(searchChannel("BLOG", "blog", normalizedKeyword));
        results.addAll(searchChannel("NEWS", "news", normalizedKeyword));
        results.addAll(searchChannel("WEB", "webkr", normalizedKeyword));

        searchLogRepository.saveAll(results.stream()
                .map(result -> new BrandKeywordSearchLog(
                        normalizedKeyword,
                        result.channel(),
                        result.title(),
                        result.description(),
                        result.link(),
                        result.publishedAt(),
                        searchedAt
                ))
                .toList());

        int blogCount = countByChannel(results, "BLOG");
        int newsCount = countByChannel(results, "NEWS");
        int webCount = countByChannel(results, "WEB");
        BrandMonitoringSummaryDto summary = new BrandMonitoringSummaryDto(
                results.size(),
                blogCount,
                newsCount,
                webCount
        );

        return new BrandMonitoringSearchResponse(
                normalizedKeyword,
                searchedAt,
                summary,
                buildInsights(summary),
                List.of(),
                results
        );
    }

    private List<BrandMonitoringResultDto> searchChannel(String channel, String naverPath, String keyword) {
        String url = UriComponentsBuilder.fromHttpUrl(NAVER_SEARCH_BASE_URL + "/" + naverPath + ".json")
                .queryParam("query", keyword)
                .queryParam("display", DISPLAY_COUNT)
                .queryParam("start", 1)
                .queryParam("sort", "sim")
                .build()
                .encode()
                .toUriString();

        try {
            String body = restClient.get()
                    .uri(url)
                    .header("X-Naver-Client-Id", naverClientId)
                    .header("X-Naver-Client-Secret", naverClientSecret)
                    .header(HttpHeaders.ACCEPT, "application/json")
                    .retrieve()
                    .body(String.class);

            return parseResults(channel, body);
        } catch (RestClientException e) {
            throw new CustomException(502, "네이버 API 호출에 실패했습니다");
        }
    }

    private List<BrandMonitoringResultDto> parseResults(String channel, String body) {
        try {
            JsonNode items = objectMapper.readTree(body).path("items");
            List<BrandMonitoringResultDto> results = new ArrayList<>();
            if (!items.isArray()) {
                return results;
            }

            for (JsonNode item : items) {
                results.add(new BrandMonitoringResultDto(
                        channel,
                        cleanText(item.path("title").asText("")),
                        cleanText(item.path("description").asText("")),
                        item.path("link").asText(""),
                        publishedAt(channel, item)
                ));
            }
            return results;
        } catch (Exception e) {
            throw new CustomException(502, "네이버 API 응답 처리에 실패했습니다");
        }
    }

    private String publishedAt(String channel, JsonNode item) {
        if ("BLOG".equals(channel)) {
            return item.path("postdate").asText("");
        }
        if ("NEWS".equals(channel)) {
            return item.path("pubDate").asText("");
        }
        return "";
    }

    private String cleanText(String value) {
        String withoutTags = value.replaceAll("<[^>]*>", "");
        return HtmlUtils.htmlUnescape(withoutTags).trim();
    }

    private int countByChannel(List<BrandMonitoringResultDto> results, String channel) {
        return (int) results.stream()
                .filter(result -> channel.equals(result.channel()))
                .count();
    }

    private List<String> buildInsights(BrandMonitoringSummaryDto summary) {
        List<String> insights = new ArrayList<>();
        insights.add("블로그 노출 수 " + summary.blogCount() + "건, 뉴스 노출 수 "
                + summary.newsCount() + "건, 웹문서 노출 수 " + summary.webCount() + "건입니다.");
        if (summary.newsCount() < 3) {
            insights.add("뉴스 노출이 부족합니다. 보도자료, 성과 사례, 신제품 메시지를 늘려야 합니다.");
        }
        if (summary.blogCount() < 5) {
            insights.add("블로그 콘텐츠 확장이 필요합니다. 제품 후기와 비교형 콘텐츠를 우선 보강하세요.");
        }
        if (summary.webCount() < 3) {
            insights.add("웹문서 노출이 약합니다. 브랜드 페이지와 검색 노출용 콘텐츠 정비가 필요합니다.");
        }
        if (summary.totalCount() == 0) {
            insights.add("검색 결과가 없습니다. 키워드 범위를 넓히거나 브랜드명 조합을 바꿔 확인하세요.");
        }
        return insights;
    }
}
