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
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.BrandMonitoringResultDto;
import naeil.dashboard.dto.BrandMonitoringSearchResponse;
import naeil.dashboard.dto.BrandMonitoringSummaryDto;
import naeil.dashboard.entity.KeywordTrendLog;
import naeil.dashboard.repository.KeywordTrendLogRepository;
import org.springframework.beans.factory.annotation.Value;
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
    private static final String NAVER_AD_BASE_URL = "https://api.searchad.naver.com";
    private static final int DISPLAY_COUNT = 10;
    private static final int NAVER_AD_ID_CHUNK_SIZE = 100;

    private final KeywordTrendLogRepository keywordTrendLogRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final String naverClientId;
    private final String naverClientSecret;
    private final String naverAdCustomerId;
    private final String naverAdAccessLicense;
    private final String naverAdSecretKey;
    private final String metaAccessToken;
    private final String metaAdAccountId;

    public MarketingService(
            KeywordTrendLogRepository keywordTrendLogRepository,
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            RestClient.Builder restClientBuilder,
            @Value("${naver.client-id:}") String naverClientId,
            @Value("${naver.client-secret:}") String naverClientSecret,
            @Value("${naver-ad.customer-id:}") String naverAdCustomerId,
            @Value("${naver-ad.access-license:}") String naverAdAccessLicense,
            @Value("${naver-ad.secret-key:}") String naverAdSecretKey,
            @Value("${meta.access-token:}") String metaAccessToken,
            @Value("${meta.ad-account-id:}") String metaAdAccountId
    ) {
        this.keywordTrendLogRepository = keywordTrendLogRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder.build();
        this.naverClientId = naverClientId;
        this.naverClientSecret = naverClientSecret;
        this.naverAdCustomerId = naverAdCustomerId;
        this.naverAdAccessLicense = naverAdAccessLicense;
        this.naverAdSecretKey = naverAdSecretKey;
        this.metaAccessToken = metaAccessToken;
        this.metaAdAccountId = metaAdAccountId;
    }

    @Transactional
    public BrandMonitoringSearchResponse searchKeywordTrend(String keyword) {
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        if (normalizedKeyword.isBlank()) {
            throw new CustomException(400, "검색 키워드를 입력해주세요.");
        }
        if (isBlank(naverClientId) || isBlank(naverClientSecret)) {
            throw new CustomException(400, "NAVER API 키가 설정되지 않았습니다");
        }

        LocalDateTime searchedAt = LocalDateTime.now();
        List<BrandMonitoringResultDto> results = new ArrayList<>();
        results.addAll(searchChannel("BLOG", "blog", normalizedKeyword));
        results.addAll(searchChannel("NEWS", "news", normalizedKeyword));
        results.addAll(searchChannel("WEB", "webkr", normalizedKeyword));

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

        int blogCount = countByChannel(results, "BLOG");
        int newsCount = countByChannel(results, "NEWS");
        int webCount = countByChannel(results, "WEB");
        BrandMonitoringSummaryDto summary = new BrandMonitoringSummaryDto(results.size(), blogCount, newsCount, webCount);

        return new BrandMonitoringSearchResponse(
                normalizedKeyword,
                searchedAt,
                summary,
                buildKeywordInsights(summary),
                results
        );
    }

    @Transactional
    public Map<String, Object> getNaverCpcPerformance(LocalDate from, LocalDate to) {
        validateRange(from, to);
        if (isBlank(naverAdCustomerId) || isBlank(naverAdAccessLicense) || isBlank(naverAdSecretKey)) {
            throw new CustomException(400, "API 키가 설정되지 않았습니다");
        }

        List<Map<String, Object>> liveRows = fetchNaverCpcRows(from, to);
        replaceNaverCpcRows(from, to, liveRows);

        List<Map<String, Object>> rows = loadNaverCpcRows(from, to);
        return performanceResponse("NAVER_CPC", from, to, rows, summarizeNaverRows(rows));
    }

    public Map<String, Object> getMetaAdsPerformance(LocalDate from, LocalDate to) {
        validateRange(from, to);
        if (isBlank(metaAccessToken) || isBlank(metaAdAccountId)) {
            throw new CustomException(400, "API 키가 설정되지 않았습니다");
        }

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

        return performanceResponse("META_ADS", from, to, addMetaCpa(rows), summarizeMetaRows(rows));
    }

    @Transactional
    public Map<String, Object> getAiAnalysisSummary(LocalDate from, LocalDate to) {
        validateRange(from, to);

        Map<String, Object> naverSummary = summarizeNaverRows(loadNaverCpcRows(from, to));
        Map<String, Object> metaSummary = summarizeMetaRows(jdbcTemplate.queryForList("""
                SELECT impressions, clicks, ctr, cpc, cpm, cost, conversions, roas, campaign_name AS "campaignName"
                  FROM meta_ads_daily_stats
                 WHERE date BETWEEN ? AND ?
                """, from, to));
        Map<String, Object> keywordSummary = keywordExposureSummary(from, to);

        List<String> risks = new ArrayList<>();
        List<String> actions = new ArrayList<>();
        BigDecimal totalAdCost = decimal(naverSummary.get("cost")).add(decimal(metaSummary.get("cost")));
        BigDecimal blendedCtr = weightedCtr(
                longValue(naverSummary.get("impressions")) + longValue(metaSummary.get("impressions")),
                longValue(naverSummary.get("clicks")) + longValue(metaSummary.get("clicks"))
        );

        if (totalAdCost.compareTo(BigDecimal.ZERO) == 0) {
            risks.add("해당 기간 광고비 데이터가 없습니다. 네이버 CPC와 Meta 광고 데이터 적재 상태를 확인해야 합니다.");
            actions.add("광고 API 연결과 일별 성과 적재를 먼저 확인해 캠페인별 손익 판단 기준을 만드세요.");
        } else {
            if (blendedCtr.compareTo(BigDecimal.valueOf(1.0)) < 0) {
                risks.add("전체 CTR이 1% 미만입니다. 노출 대비 클릭 부족 캠페인을 우선 점검해야 합니다.");
                actions.add("CTR 낮은 캠페인은 소재, 타겟, 키워드를 분리해 예산을 즉시 제한하세요.");
            }
            if (decimal(naverSummary.get("avgCpc")).compareTo(BigDecimal.valueOf(800)) > 0) {
                risks.add("네이버 평균 CPC가 800원을 초과했습니다. CPC 과다 키워드가 있을 가능성이 높습니다.");
                actions.add("고CPC 키워드는 전환 데이터가 없으면 입찰가를 낮추고 브랜드/제품명 키워드 중심으로 재배치하세요.");
            }
        }

        if (intValue(keywordSummary.get("blogCount")) < 5) {
            risks.add("블로그 노출이 부족합니다. 키워드 콘텐츠 확장이 필요합니다.");
            actions.add("단백깡, 하이프리, 단백질 과자 중심으로 후기형 콘텐츠를 늘리세요.");
        }
        if (intValue(keywordSummary.get("newsCount")) < 3) {
            risks.add("뉴스 노출이 부족합니다. 브랜드 검색 신뢰도 확보가 약합니다.");
            actions.add("보도자료나 유통/수출 성과 메시지를 준비해 검색 노출 채널을 보강하세요.");
        }

        if (risks.isEmpty()) {
            risks.add("현재 기간에는 규칙 기준의 중대 마케팅 위험이 감지되지 않았습니다.");
        }
        if (actions.isEmpty()) {
            actions.add("성과가 확인되는 온라인 채널 예산을 유지하고, 수출/국내 집중 방향은 채널별 매출 데이터와 함께 판단하세요.");
        }

        String summary = "광고비, CTR, CPC, 브랜드 검색 노출을 기준으로 점검했습니다. "
                + "의사결정은 온라인 판매 기여도와 키워드 노출 부족 여부를 우선 기준으로 보세요.";

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

    private List<Map<String, Object>> fetchNaverCpcRows(LocalDate from, LocalDate to) {
        List<NaverCampaign> campaigns = fetchNaverCampaigns();
        Map<String, NaverCampaign> campaignById = campaigns.stream()
                .collect(LinkedHashMap::new, (map, campaign) -> map.put(campaign.id(), campaign), Map::putAll);
        List<NaverAdGroup> adGroups = fetchNaverAdGroups(campaigns);
        Map<String, NaverAdGroup> adGroupById = adGroups.stream()
                .collect(LinkedHashMap::new, (map, adGroup) -> map.put(adGroup.id(), adGroup), Map::putAll);
        List<NaverKeyword> keywords = fetchNaverKeywords(adGroups);

        List<Map<String, Object>> rows = new ArrayList<>();
        if (!keywords.isEmpty()) {
            for (List<NaverKeyword> chunk : chunks(keywords, NAVER_AD_ID_CHUNK_SIZE)) {
                rows.addAll(fetchNaverKeywordStats(from, to, chunk, campaignById, adGroupById));
            }
            if (!rows.isEmpty()) {
                return rows;
            }
        }

        for (List<NaverCampaign> chunk : chunks(campaigns, NAVER_AD_ID_CHUNK_SIZE)) {
            rows.addAll(fetchNaverCampaignStats(from, to, chunk));
        }
        return rows;
    }

    private List<NaverCampaign> fetchNaverCampaigns() {
        JsonNode body = naverAdGet("/ncc/campaigns", Map.of());
        List<NaverCampaign> campaigns = new ArrayList<>();
        if (body.isArray()) {
            for (JsonNode item : body) {
                String id = item.path("nccCampaignId").asText("");
                if (!id.isBlank()) {
                    campaigns.add(new NaverCampaign(id, item.path("name").asText(item.path("campaignName").asText(id))));
                }
            }
        }
        return campaigns;
    }

    private List<NaverAdGroup> fetchNaverAdGroups(List<NaverCampaign> campaigns) {
        List<NaverAdGroup> adGroups = new ArrayList<>();
        for (NaverCampaign campaign : campaigns) {
            JsonNode body = naverAdGet("/ncc/adgroups", Map.of("nccCampaignId", campaign.id()));
            if (!body.isArray()) {
                continue;
            }
            for (JsonNode item : body) {
                String id = item.path("nccAdgroupId").asText("");
                if (!id.isBlank()) {
                    String campaignId = item.path("nccCampaignId").asText(campaign.id());
                    String name = item.path("name").asText(item.path("adgroupName").asText(id));
                    adGroups.add(new NaverAdGroup(id, campaignId, name));
                }
            }
        }
        return adGroups;
    }

    private List<NaverKeyword> fetchNaverKeywords(List<NaverAdGroup> adGroups) {
        List<NaverKeyword> keywords = new ArrayList<>();
        for (NaverAdGroup adGroup : adGroups) {
            JsonNode body = naverAdGet("/ncc/keywords", Map.of("nccAdgroupId", adGroup.id()));
            if (!body.isArray()) {
                continue;
            }
            for (JsonNode item : body) {
                String id = item.path("nccKeywordId").asText("");
                if (!id.isBlank()) {
                    String text = item.path("keyword").asText(item.path("name").asText(id));
                    keywords.add(new NaverKeyword(id, adGroup.id(), text));
                }
            }
        }
        return keywords;
    }

    private List<Map<String, Object>> fetchNaverKeywordStats(
            LocalDate from,
            LocalDate to,
            List<NaverKeyword> keywords,
            Map<String, NaverCampaign> campaignById,
            Map<String, NaverAdGroup> adGroupById
    ) {
        Map<String, NaverKeyword> keywordById = keywords.stream()
                .collect(HashMap::new, (map, keyword) -> map.put(keyword.id(), keyword), Map::putAll);
        JsonNode body = naverStatsGet(from, to, keywordById.keySet().stream().toList());

        List<Map<String, Object>> rows = new ArrayList<>();
        for (JsonNode stat : statsItems(body)) {
            String keywordId = stat.path("id").asText(stat.path("nccKeywordId").asText(""));
            NaverKeyword keyword = keywordById.get(keywordId);
            if (keyword == null) {
                continue;
            }
            NaverAdGroup adGroup = adGroupById.get(keyword.adGroupId());
            NaverCampaign campaign = adGroup == null ? null : campaignById.get(adGroup.campaignId());
            rows.add(naverStatRow(
                    from,
                    campaign == null ? "미확인 캠페인" : campaign.name(),
                    adGroup == null ? "미확인 광고그룹" : adGroup.name(),
                    keyword.text(),
                    stat
            ));
        }
        return rows;
    }

    private List<Map<String, Object>> fetchNaverCampaignStats(
            LocalDate from,
            LocalDate to,
            List<NaverCampaign> campaigns
    ) {
        Map<String, NaverCampaign> campaignById = campaigns.stream()
                .collect(HashMap::new, (map, campaign) -> map.put(campaign.id(), campaign), Map::putAll);
        JsonNode body = naverStatsGet(from, to, campaignById.keySet().stream().toList());

        List<Map<String, Object>> rows = new ArrayList<>();
        for (JsonNode stat : statsItems(body)) {
            String campaignId = stat.path("id").asText("");
            NaverCampaign campaign = campaignById.get(campaignId);
            rows.add(naverStatRow(
                    from,
                    campaign == null ? "미확인 캠페인" : campaign.name(),
                    "-",
                    "-",
                    stat
            ));
        }
        return rows;
    }

    private JsonNode naverStatsGet(LocalDate from, LocalDate to, List<String> ids) {
        URI uri = buildNaverStatsUri(from, to, ids);
        Map<String, String> headers = naverAdHeaders("GET", "/stats");
        try {
            String body = restClient.get()
                    .uri(uri)
                    .headers(httpHeaders -> headers.forEach(httpHeaders::set))
                    .retrieve()
                    .body(String.class);
            return objectMapper.readTree(body == null ? "{}" : body);
        } catch (RestClientResponseException e) {
            throw new CustomException(502, "네이버 검색광고 API 실패: /stats / "
                    + e.getStatusCode().value() + " / " + safeNaverErrorBody(e.getResponseBodyAsString()));
        } catch (RestClientException e) {
            throw new CustomException(502, "네이버 검색광고 API 통신 실패: /stats");
        } catch (JsonProcessingException e) {
            throw new CustomException(502, "네이버 검색광고 응답을 처리하지 못했습니다");
        }
    }

    private URI buildNaverStatsUri(LocalDate from, LocalDate to, List<String> ids) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(NAVER_AD_BASE_URL + "/stats");
        ids.forEach(id -> builder.queryParam("ids", id));
        builder.queryParam("fields", toJson(List.of("impCnt", "clkCnt", "ctr", "cpc", "salesAmt", "ccnt")));
        builder.queryParam("timeRange", "{\"since\":\"" + from + "\",\"until\":\"" + to + "\"}");
        return builder.build().encode().toUri();
    }

    private JsonNode naverAdGet(String path, Map<String, String> params) {
        URI uri = buildNaverAdUri(path, params);
        Map<String, String> headers = naverAdHeaders("GET", path);
        try {
            String body = restClient.get()
                    .uri(uri)
                    .headers(httpHeaders -> headers.forEach(httpHeaders::set))
                    .retrieve()
                    .body(String.class);
            return objectMapper.readTree(body == null ? "[]" : body);
        } catch (RestClientResponseException e) {
            throw new CustomException(502, "네이버 검색광고 API 실패: " + path + " / "
                    + e.getStatusCode().value() + " / " + safeNaverErrorBody(e.getResponseBodyAsString()));
        } catch (RestClientException e) {
            throw new CustomException(502, "네이버 검색광고 API 통신 실패: " + path);
        } catch (JsonProcessingException e) {
            throw new CustomException(502, "네이버 검색광고 응답을 처리하지 못했습니다");
        }
    }

    private String safeNaverErrorBody(String body) {
        if (body == null || body.isBlank()) {
            return "응답 본문 없음";
        }
        return body.length() > 300 ? body.substring(0, 300) : body;
    }

    private URI buildNaverAdUri(String path, Map<String, String> params) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(NAVER_AD_BASE_URL + path);
        params.forEach(builder::queryParam);
        return builder.build().encode().toUri();
    }

    private Map<String, String> naverAdHeaders(String method, String path) {
        String timestamp = String.valueOf(System.currentTimeMillis());
        String message = timestamp + "." + method + "." + path;
        String signature = hmacSha256Base64(naverAdSecretKey, message);
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("X-Timestamp", timestamp);
        headers.put("X-API-KEY", naverAdAccessLicense);
        headers.put("X-Customer", naverAdCustomerId);
        headers.put("X-Signature", signature);
        headers.put(HttpHeaders.CONTENT_TYPE, "application/json; charset=UTF-8");
        return headers;
    }

    private String hmacSha256Base64(String secretKey, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getEncoder().encodeToString(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new CustomException(500, "네이버 검색광고 서명 생성에 실패했습니다");
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new CustomException(500, "요청 파라미터 생성에 실패했습니다");
        }
    }

    private Iterable<JsonNode> statsItems(JsonNode body) {
        JsonNode data = body.has("data") ? body.path("data") : body;
        if (!data.isArray()) {
            return List.of();
        }
        List<JsonNode> items = new ArrayList<>();
        data.forEach(items::add);
        return items;
    }

    private Map<String, Object> naverStatRow(
            LocalDate date,
            String campaignName,
            String adGroupName,
            String keyword,
            JsonNode stat
    ) {
        long impressions = metricLong(stat, "impCnt");
        long clicks = metricLong(stat, "clkCnt");
        BigDecimal cost = metricDecimal(stat, "salesAmt");
        BigDecimal ctr = metricDecimal(stat, "ctr");
        if (ctr.compareTo(BigDecimal.ZERO) == 0) {
            ctr = weightedCtr(impressions, clicks);
        }
        BigDecimal avgCpc = metricDecimal(stat, "cpc");
        if (avgCpc.compareTo(BigDecimal.ZERO) == 0 && clicks > 0) {
            avgCpc = cost.divide(BigDecimal.valueOf(clicks), 2, RoundingMode.HALF_UP);
        }

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("date", date);
        row.put("campaignName", campaignName);
        row.put("adGroupName", adGroupName);
        row.put("keyword", keyword);
        row.put("impressions", impressions);
        row.put("clicks", clicks);
        row.put("ctr", ctr);
        row.put("avgCpc", avgCpc);
        row.put("cost", cost);
        row.put("conversions", metricNullableLong(stat, "ccnt"));
        return row;
    }

    private long metricLong(JsonNode node, String key) {
        return metricDecimal(node, key).longValue();
    }

    private Long metricNullableLong(JsonNode node, String key) {
        JsonNode value = metricNode(node, key);
        if (value == null || value.isMissingNode() || value.isNull()) {
            return null;
        }
        return value.asLong(0L);
    }

    private BigDecimal metricDecimal(JsonNode node, String key) {
        JsonNode value = metricNode(node, key);
        if (value == null || value.isMissingNode() || value.isNull()) {
            return BigDecimal.ZERO;
        }
        if (value.isNumber()) {
            return value.decimalValue();
        }
        String text = value.asText("").replace(",", "").trim();
        if (text.isBlank()) {
            return BigDecimal.ZERO;
        }
        return new BigDecimal(text);
    }

    private JsonNode metricNode(JsonNode node, String key) {
        if (node.has(key)) {
            return node.path(key);
        }
        if (node.has("metrics") && node.path("metrics").has(key)) {
            return node.path("metrics").path(key);
        }
        return node.path("summary").path(key);
    }

    private void replaceNaverCpcRows(LocalDate from, LocalDate to, List<Map<String, Object>> rows) {
        jdbcTemplate.update("DELETE FROM naver_cpc_daily_stats WHERE date BETWEEN ? AND ?", from, to);
        for (Map<String, Object> row : rows) {
            jdbcTemplate.update("""
                    INSERT INTO naver_cpc_daily_stats
                    (date, campaign_name, ad_group_name, keyword, impressions, clicks, ctr, avg_cpc, cost, conversions)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    row.get("date"),
                    row.get("campaignName"),
                    row.get("adGroupName"),
                    row.get("keyword"),
                    row.get("impressions"),
                    row.get("clicks"),
                    row.get("ctr"),
                    row.get("avgCpc"),
                    row.get("cost"),
                    row.get("conversions"));
        }
    }

    private List<Map<String, Object>> loadNaverCpcRows(LocalDate from, LocalDate to) {
        return jdbcTemplate.queryForList("""
                SELECT date,
                       campaign_name AS "campaignName",
                       ad_group_name AS "adGroupName",
                       keyword,
                       impressions,
                       clicks,
                       ctr,
                       avg_cpc AS "avgCpc",
                       cost,
                       conversions
                  FROM naver_cpc_daily_stats
                 WHERE date BETWEEN ? AND ?
                 ORDER BY date DESC, cost DESC
                """, from, to);
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
            throw new CustomException(502, "데이터를 불러오지 못했습니다");
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
            throw new CustomException(502, "데이터를 불러오지 못했습니다");
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
        if (summary.webCount() < 3) {
            insights.add("웹문서 노출이 약합니다. 브랜드/제품 상세 페이지의 검색 노출 구조를 점검하세요.");
        }
        if (summary.totalCount() == 0) {
            insights.add("검색 결과가 없습니다. 키워드 범위를 넓히거나 브랜드명 조합을 바꿔 확인하세요.");
        }
        return insights;
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
            response.put("message", "데이터가 없습니다. 전환 데이터 없음");
        }
        return response;
    }

    private Map<String, Object> summarizeNaverRows(List<Map<String, Object>> rows) {
        long impressions = rows.stream().mapToLong(row -> longValue(row.get("impressions"))).sum();
        long clicks = rows.stream().mapToLong(row -> longValue(row.get("clicks"))).sum();
        BigDecimal cost = rows.stream().map(row -> decimal(row.get("cost"))).reduce(BigDecimal.ZERO, BigDecimal::add);
        long conversions = rows.stream().filter(row -> row.get("conversions") != null)
                .mapToLong(row -> longValue(row.get("conversions"))).sum();
        BigDecimal ctr = weightedCtr(impressions, clicks);
        BigDecimal avgCpc = clicks > 0 ? cost.divide(BigDecimal.valueOf(clicks), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        return Map.of(
                "impressions", impressions,
                "clicks", clicks,
                "ctr", ctr,
                "avgCpc", avgCpc,
                "cost", cost,
                "conversions", conversions
        );
    }

    private Map<String, Object> summarizeMetaRows(List<Map<String, Object>> rows) {
        long impressions = rows.stream().mapToLong(row -> longValue(row.get("impressions"))).sum();
        long clicks = rows.stream().mapToLong(row -> longValue(row.get("clicks"))).sum();
        BigDecimal cost = rows.stream().map(row -> decimal(row.get("cost"))).reduce(BigDecimal.ZERO, BigDecimal::add);
        long conversions = rows.stream().filter(row -> row.get("conversions") != null)
                .mapToLong(row -> longValue(row.get("conversions"))).sum();
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
                    Long conversions = row.get("conversions") == null ? null : longValue(row.get("conversions"));
                    if (conversions == null || conversions == 0) {
                        copy.put("cpa", null);
                    } else {
                        copy.put("cpa", decimal(row.get("cost")).divide(BigDecimal.valueOf(conversions), 2, RoundingMode.HALF_UP));
                    }
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

    private int countByChannel(List<BrandMonitoringResultDto> results, String channel) {
        return (int) results.stream().filter(result -> channel.equals(result.channel())).count();
    }

    private void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new CustomException(400, "조회 기간을 확인해주세요.");
        }
        if (from.plusDays(31).isBefore(to)) {
            throw new CustomException(400, "네이버 CPC 조회 기간은 최대 32일까지만 지원합니다.");
        }
    }

    private <T> List<List<T>> chunks(List<T> source, int size) {
        List<List<T>> chunks = new ArrayList<>();
        for (int start = 0; start < source.size(); start += size) {
            chunks.add(source.subList(start, Math.min(source.size(), start + size)));
        }
        return chunks;
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
        return Long.parseLong(value.toString());
    }

    private int intValue(Object value) {
        return (int) longValue(value);
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
        return new BigDecimal(value.toString());
    }

    private record NaverCampaign(String id, String name) {
    }

    private record NaverAdGroup(String id, String campaignId, String name) {
    }

    private record NaverKeyword(String id, String adGroupId, String text) {
    }
}
