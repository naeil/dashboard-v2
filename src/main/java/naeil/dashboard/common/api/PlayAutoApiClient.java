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
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Slf4j
@Component
@RequiredArgsConstructor
public class PlayAutoApiClient {

    private static final int STOCK_LIST_PAGE_SIZE = 100;
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
        HttpHeaders headers = createHeaders(token, apiKey);

        Map<String, Object> body = new HashMap<>();
        body.put("start", 0);
        body.put("length", 1000);
        body.put("orderby", "mdate asc");
        body.put("date_type", "mdate");
        body.put("sdate", sDate);
        body.put("edate", eDate);
        body.put("delay_status", false);
        body.put("multi_type", "shop_sale_no");

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        String url = "https://openapi.playauto.io/api/orders";

        try {
            ResponseEntity<JsonNode> response = restTemplate.postForEntity(url, request, JsonNode.class);
            JsonNode rootNode = response.getBody();
            if (rootNode == null) {
                throw new CustomException(502, "Invalid orders response");
            }

            handleError(rootNode);
            return rootNode;
        } catch (RestClientException e) {
            handleException("getOrderList", e);
            return null;
        }
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
}
