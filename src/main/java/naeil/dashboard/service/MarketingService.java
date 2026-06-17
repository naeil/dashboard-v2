package naeil.dashboard.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.BrandMonitoringResultDto;
import naeil.dashboard.dto.BrandMonitoringSearchResponse;
import naeil.dashboard.dto.BrandMonitoringSummaryDto;
import naeil.dashboard.entity.KeywordTrendLog;
import naeil.dashboard.repository.KeywordTrendLogRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class MarketingService {

    private static final String NAVER_SEARCH_BASE_URL = "https://openapi.naver.com/v1/search";
    private static final String META_GRAPH_BASE_URL = "https://graph.facebook.com/v25.0";
    private static final int DISPLAY_COUNT = 10;
    private static final int RECENT_POSTING_DISPLAY_COUNT = 100;
    private static final Long DEFAULT_COMPANY_ID = 1L;

    private final KeywordTrendLogRepository keywordTrendLogRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final IntegrationCredentialService credentialService;

    public MarketingService(
            KeywordTrendLogRepository keywordTrendLogRepository,
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            RestClient.Builder restClientBuilder,
            IntegrationCredentialService credentialService
    ) {
        this.keywordTrendLogRepository = keywordTrendLogRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder.build();
        this.credentialService = credentialService;
    }

    @Transactional
    public BrandMonitoringSearchResponse searchKeywordTrend(String keyword) {
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        if (normalizedKeyword.isBlank()) {
            throw new CustomException(400, "검색 키워드를 입력해주세요.");
        }
        IntegrationCredentialService.NaverSearchCredentials naverCredentials =
                credentialService.getNaverSearchCredentials(DEFAULT_COMPANY_ID);
        if (isBlank(naverCredentials.clientId()) || isBlank(naverCredentials.clientSecret())) {
            throw new CustomException(400, "NAVER API 키가 설정되지 않았습니다.");
        }

        LocalDateTime searchedAt = LocalDateTime.now();
        SearchChannelResult blogResult = searchChannel("BLOG", "blog", normalizedKeyword, null, DISPLAY_COUNT, naverCredentials);
        SearchChannelResult newsResult = searchChannel("NEWS", "news", normalizedKeyword, null, DISPLAY_COUNT, naverCredentials);
        SearchChannelResult webResult = searchChannel("WEB", "webkr", normalizedKeyword, null, DISPLAY_COUNT, naverCredentials);
        SearchChannelResult recentBlogResult = searchChannel("BLOG", "blog", normalizedKeyword, "date", RECENT_POSTING_DISPLAY_COUNT, naverCredentials);
        SearchChannelResult recentNewsResult = searchChannel("NEWS", "news", normalizedKeyword, "date", RECENT_POSTING_DISPLAY_COUNT, naverCredentials);

        List<BrandMonitoringResultDto> results = new ArrayList<>();
        results.addAll(blogResult.results());
        results.addAll(newsResult.results());
        results.addAll(webResult.results());

        keywordTrendLogRepository.saveAll(results.stream()
                .map(result -> new KeywordTrendLog(
                        normalizedKeyword,
                        result.channel(),
                        result.title(),
                        result.description(),
                        result.link(),
                        result.publishedAt(),
                        searchedAt
                ))
                .toList());

        int blogCount = safeTotalCount(blogResult.totalCount());
        int newsCount = safeTotalCount(newsResult.totalCount());
        int webCount = safeTotalCount(webResult.totalCount());
        BrandMonitoringSummaryDto summary = new BrandMonitoringSummaryDto(
                safeTotalCount((long) blogCount + newsCount + webCount),
                blogCount,
                newsCount,
                webCount
        );

        List<BrandMonitoringResultDto> recentResults = new ArrayList<>();
        recentResults.addAll(recentBlogResult.results());
        recentResults.addAll(recentNewsResult.results());

        return new BrandMonitoringSearchResponse(
                normalizedKeyword,
                searchedAt,
                summary,
                buildKeywordInsights(summary),
                buildPostingWindows(recentResults),
                results
        );
    }

    public Map<String, Object> getLinkedSearchKeywords(String adType, int limit) {
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 30 : limit, 100));
        String normalizedAdType = normalizeNaverAdType(adType);
        List<Map<String, Object>> rows = loadRecentPerformanceKeywords(normalizedAdType, safeLimit);
        return Map.of(
                "source", "NAVER_SEARCH_AD_LINKED_KEYWORDS",
                "adType", normalizedAdType,
                "count", rows.size(),
                "keywords", rows
        );
    }

    public Map<String, Object> getNaverCpcPerformance(LocalDate from, LocalDate to, String adType) {
        return getNaverCpcPerformance(from, to, adType, null);
    }

    public Map<String, Object> getNaverCpcPerformance(LocalDate from, LocalDate to, String adType, String query) {
        validateRange(from, to);
        String normalizedAdType = normalizeNaverAdType(adType);
        List<Map<String, Object>> rows = loadNaverCpcRows(from, to, normalizedAdType, query);
        Map<String, Object> response = performanceResponse("NAVER_CPC", from, to, rows, summarizeNaverRows(rows));
        response.put("adType", normalizedAdType);
        response.put("query", query == null ? "" : query.trim());
        return response;
    }

    @Cacheable(value = "metaAdsPerformance", key = "#from + ':' + #to + ':' + #level")
    public Map<String, Object> getMetaAdsPerformance(String from, String to, String level) {
        LocalDate fromDate = parseDate(from, "from");
        LocalDate toDate = parseDate(to, "to");
        validateRange(fromDate, toDate);
        IntegrationCredentialService.MetaAdsCredentials metaCredentials = configuredMetaAdsCredentials();
        if (isBlank(metaCredentials.accessToken())) {
            throw new CustomException(400, "Meta 액세스 토큰이 설정되지 않았습니다.");
        }
        if (isBlank(metaCredentials.adAccountId())) {
            throw new CustomException(400, "Meta 광고 계정 ID가 설정되지 않았습니다.");
        }

        String normalizedLevel = normalizeMetaLevel(level);
        List<Map<String, Object>> rows = fetchMetaAdsRows(fromDate, toDate, normalizedLevel, metaCredentials);
        Map<String, Object> response = performanceResponse("META_ADS", fromDate, toDate, rows, summarizeMetaRows(rows));
        response.put("level", normalizedLevel);
        return response;
    }

    @Cacheable(value = "metaAdCreatives", key = "#from + ':' + #to")
    public Map<String, Object> getMetaAdCreatives(String from, String to) {
        LocalDate fromDate = parseDate(from, "from");
        LocalDate toDate = parseDate(to, "to");
        validateRange(fromDate, toDate);
        IntegrationCredentialService.MetaAdsCredentials metaCredentials = configuredMetaAdsCredentials();
        if (isBlank(metaCredentials.accessToken())) {
            throw new CustomException(400, "Meta 액세스 토큰이 설정되지 않았습니다.");
        }
        if (isBlank(metaCredentials.adAccountId())) {
            throw new CustomException(400, "Meta 광고 계정 ID가 설정되지 않았습니다.");
        }

        List<Map<String, Object>> rows = fetchMetaAdCreativeRows(fromDate, toDate, metaCredentials);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("source", "META_AD_CREATIVES");
        response.put("from", fromDate);
        response.put("to", toDate);
        response.put("rows", rows);
        if (rows.isEmpty()) {
            response.put("message", "표시할 광고 소재가 없습니다.");
        }
        return response;
    }

    @Deprecated
    private Map<String, Object> getMetaAdsPerformanceFromDb(LocalDate from, LocalDate to) {
        validateRange(from, to);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT date,
                       campaign_name AS "campaignName",
                       adset_name AS "adsetName",
                       ad_name AS "adName",
                       impressions,
                       clicks,
                       ctr,
                       cpc,
                       cpm,
                       cost,
                       conversions,
                       roas
                  FROM meta_ads_daily_stats
                 WHERE date BETWEEN ? AND ?
                 ORDER BY date DESC, cost DESC
                """, from, to);

        return performanceResponse("META_ADS_DB_DEPRECATED", from, to, addMetaCpa(rows), summarizeMetaRows(rows));
    }

    @Transactional
    public Map<String, Object> getAiAnalysisSummary(LocalDate from, LocalDate to) {
        validateRange(from, to);

        Map<String, Object> naverSummary = summarizeNaverRows(loadNaverCpcRows(from, to, "ALL"));
        Map<String, Object> metaSummary;
        try {
            metaSummary = summarizeMetaRows(fetchMetaAdsRows(from, to, "campaign", configuredMetaAdsCredentials()));
        } catch (CustomException e) {
            metaSummary = summarizeMetaRows(List.of());
        }
        Map<String, Object> keywordSummary = keywordExposureSummary(from, to);

        List<String> risks = new ArrayList<>();
        List<String> actions = new ArrayList<>();
        BigDecimal totalAdCost = decimal(naverSummary.get("cost")).add(decimal(metaSummary.get("cost")));
        BigDecimal blendedCtr = weightedCtr(
                longValue(naverSummary.get("impressions")) + longValue(metaSummary.get("impressions")),
                longValue(naverSummary.get("clicks")) + longValue(metaSummary.get("clicks"))
        );

        if (totalAdCost.compareTo(BigDecimal.ZERO) == 0) {
            risks.add("해당 기간 광고 데이터가 없습니다. 네이버 CPC와 Meta 광고 연동 상태를 확인해야 합니다.");
            actions.add("광고 API 연결과 캠페인 성과 적재를 먼저 확인하고 캠페인별 목표를 설정하세요.");
        } else {
            if (blendedCtr.compareTo(BigDecimal.valueOf(1.0)) < 0) {
                risks.add("전체 CTR이 1% 미만입니다. 노출 대비 클릭이 부족한 캠페인을 우선 점검해야 합니다.");
                actions.add("CTR이 낮은 캠페인의 소재, 타겟, 키워드를 분리하고 예산을 조정하세요.");
            }
            if (decimal(naverSummary.get("avgCpc")).compareTo(BigDecimal.valueOf(800)) > 0) {
                risks.add("네이버 평균 CPC가 800원을 초과했습니다. 고비용 키워드가 있는지 확인하세요.");
                actions.add("고CPC 키워드는 전환 데이터와 함께 검토하고 브랜드/제품명 중심으로 재배치하세요.");
            }
        }

        if (longValue(keywordSummary.get("blogCount")) < 5) {
            risks.add("블로그 노출이 부족합니다. 후기, 비교, 제품 사용 맥락 콘텐츠를 보강하세요.");
        }
        if (longValue(keywordSummary.get("newsCount")) < 3) {
            risks.add("뉴스 노출이 부족합니다. 보도자료 또는 브랜드 신뢰 콘텐츠가 필요합니다.");
        }
        if (risks.isEmpty()) {
            risks.add("현재 기간에는 주요 마케팅 위험이 감지되지 않았습니다.");
        }
        if (actions.isEmpty()) {
            actions.add("성과가 확인되는 채널 예산은 유지하고, 검색 노출 공백 키워드를 보강하세요.");
        }

        String summary = "광고비, CTR, CPC, 브랜드 검색 노출을 기준으로 마케팅 상태를 분석했습니다.";

        jdbcTemplate.update("""
                INSERT INTO marketing_ai_analysis_logs (from_date, to_date, analysis_type, summary, risks, recommended_actions)
                VALUES (?, ?, ?, ?, ?, ?)
                """, from, to, "RULE_BASED_MARKETING", summary, String.join("\n", risks), String.join("\n", actions));

        return Map.of(
                "from", from,
                "to", to,
                "summary", summary,
                "risks", risks,
                "recommendedActions", actions,
                "sourceData", Map.of(
                        "keywordTrend", keywordSummary,
                        "naverCpc", naverSummary,
                        "metaAds", metaSummary
                )
        );
    }

    private SearchChannelResult searchChannel(
            String channel,
            String endpoint,
            String keyword,
            String sort,
            int displayCount,
            IntegrationCredentialService.NaverSearchCredentials credentials
    ) {
        URI uri = UriComponentsBuilder.fromHttpUrl(NAVER_SEARCH_BASE_URL + "/" + endpoint + ".json")
                .queryParam("query", keyword)
                .queryParam("display", displayCount)
                .queryParam("start", 1)
                .queryParam("sort", sort == null ? "sim" : sort)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();
        try {
            String body = restClient.get()
                    .uri(uri)
                    .header("X-Naver-Client-Id", credentials.clientId())
                    .header("X-Naver-Client-Secret", credentials.clientSecret())
                    .header(HttpHeaders.CONTENT_TYPE, "application/json; charset=UTF-8")
                    .retrieve()
                    .body(String.class);
            JsonNode root = objectMapper.readTree(body == null ? "{}" : body);
            List<BrandMonitoringResultDto> results = new ArrayList<>();
            for (JsonNode item : root.path("items")) {
                results.add(new BrandMonitoringResultDto(
                        channel,
                        cleanHtml(item.path("title").asText("")),
                        cleanHtml(item.path("description").asText("")),
                        item.path("link").asText(""),
                        firstText(item, "postdate", "pubDate")
                ));
            }
            return new SearchChannelResult(results, root.path("total").asLong(results.size()));
        } catch (RestClientResponseException e) {
            throw new CustomException(502, "네이버 검색 API 실패: " + e.getStatusCode().value());
        } catch (RestClientException | JsonProcessingException e) {
            throw new CustomException(502, "네이버 검색 데이터를 불러오지 못했습니다.");
        }
    }

    private List<Map<String, Object>> fetchMetaAdsRows(
            LocalDate from,
            LocalDate to,
            String level,
            IntegrationCredentialService.MetaAdsCredentials credentials
    ) {
        URI uri = buildMetaAdsInsightsUri(from, to, level, credentials);
        try {
            String body = restClient.get()
                    .uri(uri)
                    .header(HttpHeaders.CONTENT_TYPE, "application/json; charset=UTF-8")
                    .retrieve()
                    .body(String.class);
            JsonNode data = objectMapper.readTree(body == null ? "{}" : body).path("data");
            if (!data.isArray()) {
                return List.of();
            }

            List<Map<String, Object>> rows = new ArrayList<>();
            for (JsonNode item : data) {
                rows.add(metaAdsRow(item));
            }
            return rows;
        } catch (RestClientResponseException e) {
            throw metaAdsException(e.getResponseBodyAsString(StandardCharsets.UTF_8));
        } catch (RestClientException e) {
            throw new CustomException(502, "Meta 광고 API 통신 실패: " + e.getMessage());
        } catch (JsonProcessingException e) {
            throw new CustomException(502, "Meta 광고 응답을 처리하지 못했습니다.");
        }
    }

    private URI buildMetaAdsInsightsUri(
            LocalDate from,
            LocalDate to,
            String level,
            IntegrationCredentialService.MetaAdsCredentials credentials
    ) {
        String timeRange = "{\"since\":\"" + from + "\",\"until\":\"" + to + "\"}";
        return UriComponentsBuilder.fromHttpUrl(META_GRAPH_BASE_URL + "/" + normalizeMetaAccountId(credentials.adAccountId()) + "/insights")
                .queryParam("access_token", credentials.accessToken())
                .queryParam("fields", "campaign_name,spend,impressions,clicks,ctr,cpc,reach,actions")
                .queryParam("time_range", timeRange)
                .queryParam("level", level)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();
    }

    private Map<String, Object> metaAdsRow(JsonNode item) {
        BigDecimal cost = decimal(item.path("spend").asText("0"));
        long conversions = metaActionValue(item.path("actions"), List.of(
                "purchase",
                "omni_purchase",
                "offsite_conversion.fb_pixel_purchase",
                "onsite_conversion.purchase"
        ));

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("campaignName", item.path("campaign_name").asText("-"));
        row.put("spend", cost);
        row.put("cost", cost);
        row.put("impressions", item.path("impressions").asLong(0));
        row.put("reach", item.path("reach").asLong(0));
        row.put("clicks", item.path("clicks").asLong(0));
        row.put("ctr", decimal(item.path("ctr").asText("0")));
        row.put("cpc", decimal(item.path("cpc").asText("0")));
        row.put("conversions", conversions);
        row.put("cpa", conversions > 0 ? cost.divide(BigDecimal.valueOf(conversions), 2, RoundingMode.HALF_UP) : null);
        row.put("roas", BigDecimal.ZERO);
        return row;
    }

    private RuntimeException metaAdsException(String responseBody) {
        String message = responseBody == null || responseBody.isBlank() ? "응답 본문 없음" : responseBody;
        int code = 0;
        try {
            JsonNode error = objectMapper.readTree(responseBody == null ? "{}" : responseBody).path("error");
            code = error.path("code").asInt(0);
            message = error.path("message").asText(message);
        } catch (JsonProcessingException ignored) {
            // 원본 응답 메시지를 그대로 사용합니다.
        }

        if (code == 190) {
            return new CustomException(401, "Meta 토큰 만료. 갱신 필요.");
        }
        if (code == 200) {
            return new CustomException(403, "광고 계정 권한 없음");
        }
        if (code == 17 || code == 80004) {
            return new CustomException(429, "잠시 후 재시도");
        }
        return new CustomException(502, "Meta 광고 API 오류: " + message);
    }

    private List<Map<String, Object>> fetchMetaAdCreativeRows(
            LocalDate from,
            LocalDate to,
            IntegrationCredentialService.MetaAdsCredentials credentials
    ) {
        URI uri = buildMetaAdCreativesUri(from, to, credentials);
        try {
            String body = restClient.get()
                    .uri(uri)
                    .header(HttpHeaders.CONTENT_TYPE, "application/json; charset=UTF-8")
                    .retrieve()
                    .body(String.class);
            JsonNode data = objectMapper.readTree(body == null ? "{}" : body).path("data");
            if (!data.isArray()) {
                return List.of();
            }
            List<Map<String, Object>> rows = new ArrayList<>();
            for (JsonNode item : data) {
                rows.add(metaAdCreativeRow(item));
            }
            rows.sort((left, right) -> decimal(right.get("cost")).compareTo(decimal(left.get("cost"))));
            return rows;
        } catch (RestClientResponseException e) {
            throw metaAdsException(e.getResponseBodyAsString(StandardCharsets.UTF_8));
        } catch (RestClientException e) {
            throw new CustomException(502, "Meta 광고 소재 API 통신 실패: " + e.getMessage());
        } catch (JsonProcessingException e) {
            throw new CustomException(502, "Meta 광고 소재 응답을 처리하지 못했습니다.");
        }
    }

    private URI buildMetaAdCreativesUri(
            LocalDate from,
            LocalDate to,
            IntegrationCredentialService.MetaAdsCredentials credentials
    ) {
        String timeRange = "{\"since\":\"" + from + "\",\"until\":\"" + to + "\"}";
        String fields = "name,effective_status,"
                + "campaign{name},"
                + "creative{thumbnail_url,image_url,title,body,object_story_spec},"
                + "insights.time_range(" + timeRange + "){spend,impressions,clicks,ctr,cpc,reach}";
        return UriComponentsBuilder.fromHttpUrl(META_GRAPH_BASE_URL + "/" + normalizeMetaAccountId(credentials.adAccountId()) + "/ads")
                .queryParam("access_token", credentials.accessToken())
                .queryParam("fields", fields)
                .queryParam("limit", 50)
                .queryParam("thumbnail_width", 800)
                .queryParam("thumbnail_height", 800)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();
    }

    private Map<String, Object> metaAdCreativeRow(JsonNode item) {
        JsonNode creative = item.path("creative");
        JsonNode storySpec = creative.path("object_story_spec");
        JsonNode linkData = storySpec.path("link_data");
        JsonNode videoData = storySpec.path("video_data");

        String thumbnail = firstNonBlank(
                creative.path("image_url").asText(""),
                creative.path("thumbnail_url").asText(""),
                linkData.path("picture").asText("")
        );
        String title = firstNonBlank(
                creative.path("title").asText(""),
                linkData.path("name").asText(""),
                videoData.path("title").asText("")
        );
        String bodyText = firstNonBlank(
                creative.path("body").asText(""),
                linkData.path("message").asText(""),
                videoData.path("message").asText("")
        );

        JsonNode insightData = item.path("insights").path("data");
        JsonNode metric = insightData.isArray() && insightData.size() > 0
                ? insightData.get(0)
                : objectMapper.createObjectNode();
        BigDecimal cost = decimal(metric.path("spend").asText("0"));

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("adName", item.path("name").asText("-"));
        row.put("campaignName", item.path("campaign").path("name").asText("-"));
        row.put("status", item.path("effective_status").asText("-"));
        row.put("thumbnailUrl", thumbnail);
        row.put("title", title);
        row.put("body", bodyText);
        row.put("cost", cost);
        row.put("spend", cost);
        row.put("impressions", metric.path("impressions").asLong(0));
        row.put("reach", metric.path("reach").asLong(0));
        row.put("clicks", metric.path("clicks").asLong(0));
        row.put("ctr", decimal(metric.path("ctr").asText("0")));
        row.put("cpc", decimal(metric.path("cpc").asText("0")));
        return row;
    }

    private List<Map<String, Object>> loadNaverCpcRows(LocalDate from, LocalDate to, String adType) {
        return loadNaverCpcRows(from, to, adType, null);
    }

    private List<Map<String, Object>> loadNaverCpcRows(LocalDate from, LocalDate to, String adType, String query) {
        String normalizedQuery = query == null || query.trim().isEmpty() ? null : query.trim();
        List<Object> params = new ArrayList<>();
        params.add(from);
        params.add(to);
        String filterSql = "";
        if (!"ALL".equals(adType)) {
            filterSql += " AND ad_type = ? ";
            params.add(adType);
        }
        if (normalizedQuery != null) {
            filterSql += """
                     AND (
                         campaign_name ILIKE CONCAT('%', ?::text, '%')
                         OR ad_group_name ILIKE CONCAT('%', ?::text, '%')
                         OR keyword ILIKE CONCAT('%', ?::text, '%')
                     )
                    """;
            params.add(normalizedQuery);
            params.add(normalizedQuery);
            params.add(normalizedQuery);
        }
        return jdbcTemplate.queryForList("""
                SELECT date,
                       ad_type AS "adType",
                       CASE ad_type
                           WHEN 'POWERLINK' THEN '파워링크'
                           WHEN 'SHOPPING_SEARCH' THEN '쇼핑검색'
                           ELSE '기타'
                       END AS "adTypeLabel",
                       campaign_name AS "campaignName",
                       ad_group_name AS "adGroupName",
                       keyword,
                       impressions,
                       clicks,
                       ctr,
                       avg_cpc AS "avgCpc",
                       cost,
                       conversions,
                       conversion_value AS "conversionValue",
                       roas
                 FROM naver_cpc_daily_stats
                 WHERE date BETWEEN ? AND ?
                """ + filterSql + """
                 ORDER BY date DESC, cost DESC
                """, params.toArray());
    }

    private List<Map<String, Object>> loadRecentPerformanceKeywords(String adType, int limit) {
        Object[] params = "ALL".equals(adType)
                ? new Object[] { limit }
                : new Object[] { adType, limit };
        String filterSql = "ALL".equals(adType) ? "" : " AND ad_type = ? ";
        return jdbcTemplate.queryForList("""
                SELECT keyword,
                       ad_type AS "adType",
                       CASE ad_type
                           WHEN 'POWERLINK' THEN '파워링크'
                           WHEN 'SHOPPING_SEARCH' THEN '쇼핑검색'
                           ELSE '기타'
                       END AS "adTypeLabel",
                       'PERFORMANCE_KEYWORD' AS "sourceType",
                       MAX(campaign_name) AS "campaignName",
                       MAX(ad_group_name) AS "adGroupName",
                       SUM(cost) AS "cost",
                       SUM(clicks) AS "clicks",
                       MAX(date) AS "lastSeenDate"
                  FROM naver_cpc_daily_stats
                 WHERE keyword IS NOT NULL
                   AND keyword <> '-'
                   AND keyword <> ''
                   AND date >= CURRENT_DATE - INTERVAL '120 days'
                """ + filterSql + """
                 GROUP BY keyword, ad_type
                 ORDER BY SUM(cost) DESC, SUM(clicks) DESC, MAX(date) DESC
                 LIMIT ?
                """, params);
    }

    private Map<String, Object> performanceResponse(
            String source,
            LocalDate from,
            LocalDate to,
            List<Map<String, Object>> rows,
            Map<String, Object> summary
    ) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("source", source);
        response.put("from", from);
        response.put("to", to);
        response.put("summary", summary);
        response.put("rows", rows);
        if (rows.isEmpty()) {
            response.put("message", "표시할 데이터가 없습니다.");
        }
        return response;
    }

    private Map<String, Object> summarizeNaverRows(List<Map<String, Object>> rows) {
        long impressions = rows.stream().mapToLong(row -> longValue(row.get("impressions"))).sum();
        long clicks = rows.stream().mapToLong(row -> longValue(row.get("clicks"))).sum();
        BigDecimal cost = rows.stream().map(row -> decimal(row.get("cost"))).reduce(BigDecimal.ZERO, BigDecimal::add);
        long conversions = rows.stream().mapToLong(row -> longValue(row.get("conversions"))).sum();
        BigDecimal conversionValue = rows.stream().map(row -> decimal(row.get("conversionValue"))).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal ctr = weightedCtr(impressions, clicks);
        BigDecimal avgCpc = clicks > 0 ? cost.divide(BigDecimal.valueOf(clicks), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        BigDecimal roas = cost.compareTo(BigDecimal.ZERO) > 0
                ? conversionValue.multiply(BigDecimal.valueOf(100)).divide(cost, 2, RoundingMode.HALF_UP)
                : average(rows, "roas");
        return Map.of(
                "impressions", impressions,
                "clicks", clicks,
                "ctr", ctr,
                "avgCpc", avgCpc,
                "cost", cost,
                "conversions", conversions,
                "conversionValue", conversionValue,
                "roas", roas
        );
    }

    private Map<String, Object> summarizeMetaRows(List<Map<String, Object>> rows) {
        long impressions = rows.stream().mapToLong(row -> longValue(row.get("impressions"))).sum();
        long clicks = rows.stream().mapToLong(row -> longValue(row.get("clicks"))).sum();
        BigDecimal cost = rows.stream().map(row -> decimal(row.get("cost"))).reduce(BigDecimal.ZERO, BigDecimal::add);
        long conversions = rows.stream().mapToLong(row -> longValue(row.get("conversions"))).sum();
        BigDecimal ctr = weightedCtr(impressions, clicks);
        BigDecimal cpc = clicks > 0 ? cost.divide(BigDecimal.valueOf(clicks), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        BigDecimal roas = average(rows, "roas");
        return Map.of(
                "impressions", impressions,
                "clicks", clicks,
                "ctr", ctr,
                "cpc", cpc,
                "cost", cost,
                "conversions", conversions,
                "roas", roas
        );
    }

    private List<Map<String, Object>> addMetaCpa(List<Map<String, Object>> rows) {
        return rows.stream()
                .map(row -> {
                    Map<String, Object> copy = new LinkedHashMap<>(row);
                    long conversions = longValue(row.get("conversions"));
                    copy.put("cpa", conversions == 0 ? null : decimal(row.get("cost")).divide(BigDecimal.valueOf(conversions), 2, RoundingMode.HALF_UP));
                    return copy;
                })
                .toList();
    }

    private Map<String, Object> keywordExposureSummary(LocalDate from, LocalDate to) {
        Map<String, Object> rows = jdbcTemplate.queryForMap("""
                SELECT COUNT(*) AS total_count,
                       COUNT(*) FILTER (WHERE channel = 'BLOG') AS blog_count,
                       COUNT(*) FILTER (WHERE channel = 'NEWS') AS news_count,
                       COUNT(*) FILTER (WHERE channel = 'WEB') AS web_count
                  FROM keyword_trend_logs
                 WHERE searched_at::date BETWEEN ? AND ?
                """, from, to);
        return Map.of(
                "totalCount", longValue(rows.get("total_count")),
                "blogCount", longValue(rows.get("blog_count")),
                "newsCount", longValue(rows.get("news_count")),
                "webCount", longValue(rows.get("web_count"))
        );
    }

    private List<String> buildKeywordInsights(BrandMonitoringSummaryDto summary) {
        List<String> insights = new ArrayList<>();
        insights.add("블로그 노출 " + summary.blogCount() + "건, 뉴스 노출 "
                + summary.newsCount() + "건, 웹문서 노출 " + summary.webCount() + "건입니다.");
        if (summary.newsCount() < 3) {
            insights.add("뉴스 노출이 부족합니다. 보도자료 또는 브랜드 신뢰 콘텐츠가 필요합니다.");
        }
        if (summary.blogCount() < 5) {
            insights.add("블로그 콘텐츠 확장이 필요합니다. 후기, 비교, 제품 사용 맥락 콘텐츠를 보강하세요.");
        }
        if (summary.webCount() < 5) {
            insights.add("웹문서 노출이 약합니다. 브랜드/제품 상세 페이지의 검색 노출 구조를 점검하세요.");
        }
        return insights;
    }

    private List<Map<String, Object>> buildPostingWindows(List<BrandMonitoringResultDto> results) {
        return List.of(
                postingWindow("최근 7일", 7, results),
                postingWindow("최근 30일", 30, results),
                postingWindow("최근 3개월", 90, results)
        );
    }

    private Map<String, Object> postingWindow(String label, int days, List<BrandMonitoringResultDto> results) {
        LocalDate since = LocalDate.now().minusDays(days - 1L);
        int blogCount = 0;
        int newsCount = 0;
        int totalCount = 0;

        for (BrandMonitoringResultDto result : results) {
            LocalDate publishedDate = parsePublishedDate(result);
            if (publishedDate == null || publishedDate.isBefore(since)) {
                continue;
            }
            totalCount++;
            if ("BLOG".equals(result.channel())) {
                blogCount++;
            } else if ("NEWS".equals(result.channel())) {
                newsCount++;
            }
        }

        String signal;
        String action;
        if (days == 7) {
            signal = totalCount >= 12 ? "활발" : totalCount >= 5 ? "관찰" : "부족";
            action = totalCount >= 12
                    ? "최근 콘텐츠 반응이 빠르게 쌓이고 있습니다. 광고와 콘텐츠를 동시에 집행하기 좋은 구간입니다."
                    : totalCount >= 5
                    ? "최근 언급이 생기고 있습니다. 이번 주 안에 블로그와 뉴스 보강을 검토하세요."
                    : "최근 노출이 약합니다. 신규 포스팅 또는 보도자료를 먼저 준비하세요.";
        } else if (days == 30) {
            signal = totalCount >= 30 ? "경쟁 강함" : totalCount >= 12 ? "진입 가능" : "공백";
            action = totalCount >= 30
                    ? "월간 콘텐츠 경쟁이 강합니다. 차별 키워드와 상세페이지 보강이 필요합니다."
                    : totalCount >= 12
                    ? "월간 검색 노출을 만들 수 있는 구간입니다. 체험단과 비교 콘텐츠를 배치하세요."
                    : "월간 콘텐츠 공백이 큽니다. 기본 리뷰형 콘텐츠를 쌓는 것이 좋습니다.";
        } else {
            signal = totalCount >= 60 ? "성숙" : totalCount >= 20 ? "성장" : "초기";
            action = totalCount >= 60
                    ? "3개월 누적 콘텐츠가 많습니다. 광고 효율보다 메시지 차별화가 중요합니다."
                    : totalCount >= 20
                    ? "시장 반응을 쌓는 중입니다. 주간 단위 콘텐츠 캘린더를 운영하세요."
                    : "3개월 누적 노출이 낮습니다. 콘텐츠 예산과 제작 계획을 먼저 축적하세요.";
        }

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("days", days);
        row.put("totalCount", totalCount);
        row.put("blogCount", blogCount);
        row.put("newsCount", newsCount);
        row.put("signal", signal);
        row.put("action", action);
        row.put("basis", "네이버 최신순 블로그/뉴스 검색 결과 최대 100건씩 기준");
        return row;
    }

    private LocalDate parsePublishedDate(BrandMonitoringResultDto result) {
        String value = result.publishedAt();
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            if ("BLOG".equals(result.channel())) {
                return LocalDate.parse(value, DateTimeFormatter.BASIC_ISO_DATE);
            }
            if ("NEWS".equals(result.channel())) {
                return ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toLocalDate();
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private LocalDate parseDate(String value, String fieldName) {
        try {
            return LocalDate.parse(value);
        } catch (Exception e) {
            throw new CustomException(400, fieldName + " 날짜 형식을 확인해주세요.");
        }
    }

    private void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new CustomException(400, "조회 기간을 확인해주세요.");
        }
        if (from.plusDays(31).isBefore(to)) {
            throw new CustomException(400, "광고 성과 조회 기간은 최대 32일까지만 지원합니다.");
        }
    }

    private long metaActionValue(JsonNode actions, List<String> actionTypes) {
        if (!actions.isArray()) {
            return 0L;
        }
        long total = 0L;
        for (JsonNode action : actions) {
            if (actionTypes.contains(action.path("action_type").asText(""))) {
                total += decimal(action.path("value").asText("0")).longValue();
            }
        }
        return total;
    }

    private String normalizeMetaAccountId(String accountId) {
        String value = accountId == null ? "" : accountId.trim();
        if (value.isBlank()) {
            return value;
        }
        return value.startsWith("act_") ? value : "act_" + value;
    }

    private IntegrationCredentialService.MetaAdsCredentials configuredMetaAdsCredentials() {
        return credentialService.getMetaAdsCredentials(DEFAULT_COMPANY_ID);
    }

    private String normalizeMetaLevel(String level) {
        String value = level == null ? "campaign" : level.trim().toLowerCase();
        if (List.of("campaign", "adset", "ad").contains(value)) {
            return value;
        }
        return "campaign";
    }

    private String normalizeNaverAdType(String adType) {
        String value = adType == null ? "ALL" : adType.trim().toUpperCase();
        if (value.isBlank() || "ALL".equals(value)) {
            return "ALL";
        }
        if ("SHOPPING".equals(value) || "SHOPPING_SEARCH".equals(value) || "SHOPPING_SEARCH_AD".equals(value)) {
            return "SHOPPING_SEARCH";
        }
        if ("POWERLINK".equals(value) || "POWER_LINK".equals(value) || "WEB_SITE".equals(value)) {
            return "POWERLINK";
        }
        return "OTHER";
    }

    private String cleanHtml(String value) {
        return HtmlUtils.htmlUnescape(value == null ? "" : value.replaceAll("<[^>]*>", "")).trim();
    }

    private String firstText(JsonNode node, String... keys) {
        for (String key : keys) {
            String value = node.path(key).asText("");
            if (!value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private BigDecimal average(List<Map<String, Object>> rows, String key) {
        List<BigDecimal> values = rows.stream()
                .map(row -> decimal(row.get(key)))
                .filter(value -> value.compareTo(BigDecimal.ZERO) > 0)
                .toList();
        if (values.isEmpty()) {
            return BigDecimal.ZERO;
        }
        return values.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(values.size()), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal weightedCtr(long impressions, long clicks) {
        if (impressions == 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(clicks)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(impressions), 2, RoundingMode.HALF_UP);
    }

    private int safeTotalCount(long value) {
        if (value > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) value);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private long longValue(Object value) {
        if (value == null) {
            return 0L;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return new BigDecimal(value.toString()).longValue();
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private BigDecimal decimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private record SearchChannelResult(List<BrandMonitoringResultDto> results, long totalCount) {
    }
}
