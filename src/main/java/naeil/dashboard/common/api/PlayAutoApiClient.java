package naeil.dashboard.common.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.PlayAutoShopResponseDTO;
import naeil.dashboard.dto.PlayAutoStockConditionResponseDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Slf4j
@Component
@RequiredArgsConstructor
public class PlayAutoApiClient {

    private static final int STOCK_LIST_PAGE_SIZE = 100;
    private static final int ORDER_LIST_MAX_RETRIES = 3;
    private static final DateTimeFormatter ISO_DATE_FORMATTER = DateTimeFormatter.ISO_DATE;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${playauto.api.key:}")
    private String defaultApiKey;

    public String getPlayToken(String email, String password, String apiKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey != null ? apiKey : defaultApiKey);

        Map<String, Object> body = Map.of(
                "email", email,
                "password", password
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        String url = UriComponentsBuilder
                .fromUriString("https://openapi.playauto.io/api/auth")
                .toUriString();

        try {
            ResponseEntity<JsonNode> response = restTemplate.exchange(url, HttpMethod.POST, request, JsonNode.class);
            JsonNode rootNode = response.getBody();
            if (rootNode == null) {
                throw new CustomException(502, "Invalid auth response");
            }

            handleError(rootNode);

            if (!rootNode.isArray() || rootNode.isEmpty()) {
                throw new CustomException(502, "Invalid auth response");
            }

            String token = rootNode.get(0).path("token").asText("");
            if (token.isBlank()) {
                throw new CustomException(502, "Invalid auth response");
            }
            return token;
        } catch (Exception e) {
            handleException("getPlayToken", e);
            return null;
        }
    }

    public PlayAutoShopResponseDTO[] getShopInfo(String token, String apiKey) {
        HttpHeaders headers = createHeaders(token, apiKey);
        HttpEntity<Void> request = new HttpEntity<>(headers);

        String url = UriComponentsBuilder
                .fromUriString("https://openapi.playauto.io/api/shops")
                .queryParam("used", "true")
                .queryParam("usable_shop", "true")
                .toUriString();

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
            JsonNode rootNode = objectMapper.readTree(response.getBody());

            handleError(rootNode);

            if (rootNode.isArray()) {
                return objectMapper.treeToValue(rootNode, PlayAutoShopResponseDTO[].class);
            }
            return new PlayAutoShopResponseDTO[0];
        } catch (Exception e) {
            handleException("getShopInfo", e);
            return null;
        }
    }

    public PlayAutoStockConditionResponseDTO getStockConditionList(String token, String apiKey) {
        HttpHeaders headers = createHeaders(token, apiKey);
        String url = "https://openapi.playauto.io/api/stock/condition";
        String today = LocalDate.now().format(ISO_DATE_FORMATTER);

        try {
            List<PlayAutoStockConditionResponseDTO.StockConditionItem> allResults = new ArrayList<>();
            Integer total = null;
            int start = 0;

            while (true) {
                Map<String, Object> body = new HashMap<>();
                body.put("start", start);
                body.put("limit", STOCK_LIST_PAGE_SIZE);
                body.put("date_type", "mdate");
                body.put("edate", today);

                HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
                ResponseEntity<PlayAutoStockConditionResponseDTO> response =
                        restTemplate.postForEntity(url, request, PlayAutoStockConditionResponseDTO.class);
                PlayAutoStockConditionResponseDTO page = response.getBody();
                if (page == null || page.getResults() == null || page.getResults().isEmpty()) {
                    break;
                }

                if (total == null && page.getRecordsTotal() > 0) {
                    total = page.getRecordsTotal();
                }

                allResults.addAll(page.getResults());

                if (page.getResults().size() < STOCK_LIST_PAGE_SIZE) {
                    break;
                }

                if (total != null && allResults.size() >= total) {
                    break;
                }

                start += STOCK_LIST_PAGE_SIZE;
            }

            PlayAutoStockConditionResponseDTO merged = new PlayAutoStockConditionResponseDTO();
            merged.setResults(allResults);
            merged.setRecordsTotal(total != null ? total : allResults.size());
            return merged;
        } catch (RestClientException e) {
            handleException("getStockConditionList", e);
            return null;
        }
    }

    public JsonNode getOrderList(String token, String apiKey, String sDate, String eDate) {
        // PlayAuto 대시보드와 동일하게 주문일(ord_date) 기준으로 조회
        // 페이지네이션으로 1000건 초과 주문도 누락 없이 수집
        final int PAGE_SIZE = 500;
        String url = "https://openapi.playauto.io/api/orders";
        HttpHeaders headers = createHeaders(token, apiKey);

        com.fasterxml.jackson.databind.node.ArrayNode allResults = objectMapper.createArrayNode();
        int start = 0;
        int totalRecords = Integer.MAX_VALUE;

        while (start < totalRecords) {
            Map<String, Object> body = new HashMap<>();
            body.put("start", start);
            body.put("length", PAGE_SIZE);
            body.put("orderby", "wdate");
            body.put("date_type", "ord_date");
            body.put("sdate", sDate);
            body.put("edate", eDate);
            body.put("delay_status", false);
            body.put("multi_type", "shop_sale_no");

            JsonNode rootNode = null;
            for (int attempt = 1; attempt <= ORDER_LIST_MAX_RETRIES; attempt++) {
                try {
                    HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
                    ResponseEntity<JsonNode> response = restTemplate.postForEntity(url, request, JsonNode.class);
                    rootNode = response.getBody();
                    if (rootNode == null) {
                        throw new CustomException(502, "Invalid orders response");
                    }
                    try {
                        handleError(rootNode);
                    } catch (CustomException e) {
                        if (shouldRetryWithoutMultiType(e, body)) {
                            log.warn("Retrying PlayAuto order list without multi_type. sdate={}, edate={}", sDate, eDate);
                            body.remove("multi_type");
                            continue;
                        }
                        throw e;
                    }
                    break;
                } catch (RestClientException e) {
                    if (isTooManyRequests(e) && attempt < ORDER_LIST_MAX_RETRIES) {
                        sleepForRateLimit(attempt);
                        continue;
                    }
                    handleException("getOrderList", e);
                    return null;
                }
            }

            if (rootNode == null) break;

            JsonNode results = rootNode.path("results");
            if (!results.isArray() || results.isEmpty()) break;

            totalRecords = rootNode.path("recordsTotal").asInt(results.size());
            results.forEach(allResults::add);
            start += results.size();

            log.info("PlayAuto order page fetched: start={}, page={}, total={}", start - results.size(), results.size(), totalRecords);

            if (results.size() < PAGE_SIZE) break; // 마지막 페이지
        }

        // 기존 코드와 호환되는 형태로 반환 (results 필드 포함한 노드)
        com.fasterxml.jackson.databind.node.ObjectNode merged = objectMapper.createObjectNode();
        merged.put("recordsTotal", allResults.size());
        merged.set("results", allResults);
        return merged;
    }

    private HttpHeaders createHeaders(String token, String apiKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey != null ? apiKey : defaultApiKey);
        headers.set("Authorization", "Token " + token);
        return headers;
    }

    private void handleError(JsonNode rootNode) {
        if (rootNode.isObject() && rootNode.has("error_code")) {
            String errorCode = rootNode.path("error_code").asText();
            String message = rootNode.path("messages").path(0).asText();
            throw new CustomException(400, "PlayAuto Error: " + errorCode + " - " + message);
        }
    }

    private void handleException(String method, Exception e) {
        log.error("PlayAuto API Error in {}: {}", method, e.getMessage());
        if (e instanceof CustomException customException) {
            throw customException;
        }
        throw new CustomException(502, "External API communication failed: " + e.getMessage());
    }

    private boolean isTooManyRequests(RestClientException e) {
        if (e instanceof HttpStatusCodeException statusException) {
            return statusException.getStatusCode().value() == 429;
        }
        return e.getMessage() != null && e.getMessage().contains("429");
    }

    private void sleepForRateLimit(int attempt) {
        long delayMillis = attempt * 5_000L;
        log.warn("PlayAuto rate limit reached. Retrying after {} ms. attempt={}", delayMillis, attempt + 1);
        try {
            Thread.sleep(delayMillis);
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
            throw new CustomException(502, "PlayAuto retry interrupted");
        }
    }

    private boolean shouldRetryWithoutMultiType(CustomException e, Map<String, Object> body) {
        return body.containsKey("multi_type")
                && e.getMessage() != null
                && e.getMessage().contains("startsWith");
    }
}
