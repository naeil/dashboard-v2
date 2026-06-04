package naeil.dashboard.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.StringReader;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import javax.xml.parsers.DocumentBuilderFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

@Service
public class IssueBriefingService {

    private static final String NAVER_NEWS_URL = "https://openapi.naver.com/v1/search/news.json";
    private static final String GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";

    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final String naverClientId;
    private final String naverClientSecret;

    public IssueBriefingService(
            ObjectMapper objectMapper,
            RestClient.Builder restClientBuilder,
            @Value("${naver.client-id:}") String naverClientId,
            @Value("${naver.client-secret:}") String naverClientSecret
    ) {
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder.build();
        this.naverClientId = naverClientId;
        this.naverClientSecret = naverClientSecret;
    }

    @Cacheable(value = "issueBriefing", key = "'latest-v2'")
    public Map<String, Object> getIssueBriefing() {
        List<Map<String, Object>> domestic = new ArrayList<>();
        List<Map<String, Object>> global = new ArrayList<>();

        domestic.addAll(searchDomestic("경제 소비 트렌드", "경제", 5));
        domestic.addAll(searchDomestic("뷰티 화장품 트렌드", "뷰티", 5));
        domestic.addAll(searchDomestic("식품 건강기능식품 트렌드", "식품", 5));
        domestic.addAll(searchDomestic("연예인 브랜드 광고 인플루언서", "연예인", 5));

        global.addAll(searchGlobal("global economy consumer market trend", "경제", 5));
        global.addAll(searchGlobal("global beauty cosmetics industry trend", "뷰티", 5));
        global.addAll(searchGlobal("global food supplement wellness industry trend", "식품", 5));
        global.addAll(searchGlobal("celebrity influencer brand marketing trend", "연예인", 5));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("generatedAt", LocalDateTime.now());
        response.put("message", "국내외 이슈를 업무 관점으로 요약했습니다. 각 뉴스는 원문 링크로 확인할 수 있습니다.");
        response.put("highlights", buildHighlights(domestic, global));
        response.put("domestic", domestic.stream().limit(20).toList());
        response.put("global", global.stream().limit(20).toList());
        response.put("source", Map.of(
                "domestic", isBlank(naverClientId) || isBlank(naverClientSecret) ? "Google News RSS fallback" : "Naver News API",
                "global", "Google News RSS"
        ));
        return response;
    }

    private List<Map<String, Object>> buildHighlights(List<Map<String, Object>> domestic, List<Map<String, Object>> global) {
        List<Map<String, Object>> highlights = new ArrayList<>();
        domestic.stream().findFirst().ifPresent(highlights::add);
        global.stream().findFirst().ifPresent(highlights::add);
        domestic.stream().skip(1).limit(4).forEach(highlights::add);
        global.stream().skip(1).limit(4).forEach(highlights::add);
        return highlights.stream().limit(10).toList();
    }

    private List<Map<String, Object>> searchDomestic(String query, String category, int limit) {
        if (isBlank(naverClientId) || isBlank(naverClientSecret)) {
            return searchGoogleNews(query, "국내", category, limit);
        }

        URI uri = UriComponentsBuilder.fromHttpUrl(NAVER_NEWS_URL)
                .queryParam("query", query)
                .queryParam("display", limit)
                .queryParam("sort", "date")
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();

        try {
            String body = restClient.get()
                    .uri(uri)
                    .header("X-Naver-Client-Id", naverClientId)
                    .header("X-Naver-Client-Secret", naverClientSecret)
                    .header(HttpHeaders.CONTENT_TYPE, "application/json; charset=UTF-8")
                    .retrieve()
                    .body(String.class);

            JsonNode items = objectMapper.readTree(body == null ? "{}" : body).path("items");
            List<Map<String, Object>> rows = new ArrayList<>();
            for (JsonNode item : items) {
                rows.add(newsRow(
                        "국내",
                        category,
                        clean(item.path("title").asText("")),
                        clean(item.path("description").asText("")),
                        item.path("originallink").asText(item.path("link").asText("")),
                        item.path("pubDate").asText(""),
                        ""
                ));
            }
            return rows;
        } catch (RestClientException | JsonProcessingException e) {
            return searchGoogleNews(query, "국내", category, limit);
        }
    }

    private List<Map<String, Object>> searchGlobal(String query, String category, int limit) {
        return searchGoogleNews(query, "해외", category, limit);
    }

    private List<Map<String, Object>> searchGoogleNews(String query, String scope, String category, int limit) {
        URI uri = UriComponentsBuilder.fromHttpUrl(GOOGLE_NEWS_RSS_URL)
                .queryParam("q", query)
                .queryParam("hl", "ko")
                .queryParam("gl", "KR")
                .queryParam("ceid", "KR:ko")
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUri();

        try {
            String body = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(String.class);
            return parseRss(body, scope, category, limit);
        } catch (Exception e) {
            return List.of(newsRow(
                    scope,
                    category,
                    category + " 이슈를 불러오지 못했습니다.",
                    "네트워크 또는 뉴스 피드 응답을 확인해야 합니다.",
                    "",
                    "",
                    "시스템"
            ));
        }
    }

    private List<Map<String, Object>> parseRss(String xml, String scope, String category, int limit) throws Exception {
        if (xml == null || xml.isBlank()) {
            return List.of();
        }
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        Element root = factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml))).getDocumentElement();
        NodeList items = root.getElementsByTagName("item");
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = 0; i < Math.min(items.getLength(), limit); i++) {
            Element item = (Element) items.item(i);
            String rawTitle = text(item, "title");
            String title = rawTitle;
            String source = "";
            int splitAt = rawTitle.lastIndexOf(" - ");
            if (splitAt > 0) {
                title = rawTitle.substring(0, splitAt);
                source = rawTitle.substring(splitAt + 3);
            }
            rows.add(newsRow(
                    scope,
                    category,
                    clean(title),
                    clean(text(item, "description")),
                    text(item, "link"),
                    text(item, "pubDate"),
                    source
            ));
        }
        return rows;
    }

    private Map<String, Object> newsRow(
            String scope,
            String category,
            String title,
            String description,
            String link,
            String publishedAt,
            String source
    ) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("scope", scope);
        row.put("category", category);
        row.put("title", title);
        row.put("description", description);
        row.put("link", link);
        row.put("publishedAt", publishedAt);
        row.put("source", source);
        row.put("imageUrl", imageUrl(scope, category));
        row.put("oneLine", oneLine(category, title, description));
        row.put("impactArea", impactArea(category, title + " " + description));
        row.put("relevance", relevance(category, title + " " + description));
        return row;
    }

    private String imageUrl(String scope, String category) {
        String suffix = "?auto=format&fit=crop&w=1200&q=80";
        if ("뷰티".equals(category)) return "https://images.unsplash.com/photo-1596462502278-27bfdc403348" + suffix;
        if ("식품".equals(category)) return "https://images.unsplash.com/photo-1498837167922-ddd27525d352" + suffix;
        if ("연예인".equals(category)) return "https://images.unsplash.com/photo-1501386761578-eac5c94b800a" + suffix;
        if ("해외".equals(scope)) return "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e" + suffix;
        return "https://images.unsplash.com/photo-1495020689067-958852a7765e" + suffix;
    }

    private String oneLine(String category, String title, String description) {
        String text = (title + " " + description).toLowerCase(Locale.ROOT);
        if (containsAny(text, "물가", "금리", "환율", "소비", "경기", "market", "inflation", "rate")) {
            return "가격, 소비심리, 광고 효율에 영향을 줄 수 있어 매출 계획 점검이 필요합니다.";
        }
        if (containsAny(text, "뷰티", "화장품", "피부", "beauty", "cosmetic", "skin")) {
            return "뷰티 소비 트렌드는 제품 콘셉트와 콘텐츠 소재로 바로 연결할 수 있습니다.";
        }
        if (containsAny(text, "식품", "건강", "원료", "푸드", "supplement", "food", "ingredient", "wellness")) {
            return "식품/건강 이슈는 원료 선택, 상세페이지 메시지, 제품 기획에 반영해야 합니다.";
        }
        if (containsAny(text, "연예", "인플루언서", "브랜드", "celebrity", "influencer")) {
            return "브랜드 노출, 협찬, 바이럴 소재로 활용 가능한 마케팅 신호입니다.";
        }
        return category + " 이슈를 현재 제품, 광고, 영업 전략과 연결해 볼 필요가 있습니다.";
    }

    private String impactArea(String category, String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        if (containsAny(lower, "광고", "인플루언서", "브랜드", "celebrity", "influencer")) return "마케팅/콘텐츠";
        if (containsAny(lower, "수출", "환율", "global", "export", "currency")) return "수출/해외영업";
        if (containsAny(lower, "원료", "식품", "생산", "ingredient", "food")) return "제품기획/생산";
        if (containsAny(lower, "금리", "물가", "소비", "market", "rate")) return "경영/매출";
        return category + " 모니터링";
    }

    private String relevance(String category, String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        if (containsAny(lower, "건강기능식품", "원료", "뷰티", "식품", "광고", "인플루언서", "수출", "wellness", "beauty", "food", "supplement")) {
            return "높음";
        }
        if (containsAny(lower, "소비", "경기", "연예", "market", "celebrity")) {
            return "보통";
        }
        return "참고";
    }

    private String text(Element item, String tagName) {
        NodeList nodes = item.getElementsByTagName(tagName);
        if (nodes.getLength() == 0 || nodes.item(0) == null) {
            return "";
        }
        return nodes.item(0).getTextContent();
    }

    private String clean(String value) {
        return HtmlUtils.htmlUnescape(value == null ? "" : value.replaceAll("<[^>]*>", "")).trim();
    }

    private boolean containsAny(String value, String... needles) {
        for (String needle : needles) {
            if (value.contains(needle.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
