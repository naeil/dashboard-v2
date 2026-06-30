package naeil.dashboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
  @Service
  @RequiredArgsConstructor
  public class NaverAdSyncService {

    private static final String NAVER_AD_BASE_URL = "https://api.searchad.naver.com";
        private static final Long DEFAULT_COMPANY_ID = 1L;
        private static final DateTimeFormatter NAVER_DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final JdbcTemplate jdbcTemplate;
        private final IntegrationCredentialService credentialService;
        private final ObjectMapper objectMapper;
        private final HttpClient httpClient = HttpClient.newHttpClient();

    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Seoul")
        public void scheduledSync() {
                  log.info("[NaverAdSync] scheduled sync start");
                  LocalDate yesterday = LocalDate.now().minusDays(1);
                  Map<String, Object> result = syncDateRange(yesterday, yesterday);
                  log.info("[NaverAdSync] scheduled sync done: {}", result);
        }

    @Transactional
        public Map<String, Object> syncDateRange(LocalDate from, LocalDate to) {
                  IntegrationCredentialService.NaverAdCredentials creds =
                                    credentialService.getNaverAdCredentials(DEFAULT_COMPANY_ID);

            if (isBlank(creds.customerId()) || isBlank(creds.accessLicense()) || isBlank(creds.secretKey())) {
                          return Map.of("success", false, "message", "Naver AD API credentials not configured.");
            }

            Map<String, Object> result = new LinkedHashMap<>();
                  int totalUpserted = 0;

            try {
                          int n = syncAdType(creds, from, to, "POWERLINK");
                          result.put("powerlink", Map.of("success", true, "upserted", n));
                          totalUpserted += n;
            } catch (Exception e) {
                          log.error("[NaverAdSync] powerlink sync failed: {}", e.getMessage(), e);
                          result.put("powerlink", Map.of("success", false, "message", e.getMessage()));
            }

            try {
                          int n = syncAdType(creds, from, to, "SHOPPING_SEARCH");
                          result.put("shoppingSearch", Map.of("success", true, "upserted", n));
                          totalUpserted += n;
            } catch (Exception e) {
                          log.error("[NaverAdSync] shopping sync failed: {}", e.getMessage(), e);
                          result.put("shoppingSearch", Map.of("success", false, "message", e.getMessage()));
            }

            result.put("from", from.toString());
                  result.put("to", to.toString());
                  result.put("totalUpserted", totalUpserted);
                  result.put("success", true);
                  return result;
        }

    private int syncAdType(IntegrationCredentialService.NaverAdCredentials creds,
                                                      LocalDate from, LocalDate to, String adType) throws Exception {
              String campaignType = "POWERLINK".equals(adType) ? "WEB_SITE" : "SHOPPING";
              List<CampaignInfo> campaigns = fetchCampaigns(creds, campaignType);
              if (campaigns.isEmpty()) {
                            log.info("[NaverAdSync] no campaigns for {} (type={})", adType, campaignType);
                            return 0;
              }
              log.info("[NaverAdSync] {} campaigns found: {}", adType, campaigns.size());

            int upserted = 0;
              LocalDate cursor = from;
              while (!cursor.isAfter(to)) {
                            for (CampaignInfo campaign : campaigns) {
                                              try {
                                                                    Map<String, Object> summary = fetchStatsSummary(creds, campaign.id(), cursor, cursor);
                                                                    if (summary != null) {
                                                                                              upsertCampaignRow(cursor, adType, campaign.name(), summary);
                                                                                              upserted++;
                                                                    }
                                              } catch (Exception e) {
                                                                    log.warn("[NaverAdSync] campaign '{}' {} {} error: {}", campaign.name(), adType, cursor, e.getMessage());
                                              }
                            }
                            cursor = cursor.plusDays(1);
              }
              return upserted;
    }

    private List<CampaignInfo> fetchCampaigns(IntegrationCredentialService.NaverAdCredentials creds,
                                                                                             String campaignType) throws Exception {
              String body = callNaverAdApi(creds, "GET", "/ncc/campaigns", "campaignTp=" + campaignType);
              List<CampaignInfo> list = new ArrayList<>();
              JsonNode root = objectMapper.readTree(body == null ? "[]" : body);
              if (root.isArray()) {
                            for (JsonNode node : root) {
                                              String id = node.path("nccCampaignId").asText("");
                                              String name = node.path("name").asText("-");
                                              if (!id.isBlank()) list.add(new CampaignInfo(id, name));
                            }
              }
              return list;
    }

    private Map<String, Object> fetchStatsSummary(IntegrationCredentialService.NaverAdCredentials creds,
                                                                                                     String campaignId,
                                                                                                     LocalDate from, LocalDate to) throws Exception {
              String since = from.format(NAVER_DATE_FMT);
              String until = to.format(NAVER_DATE_FMT);
              String timeRangeJson = "{\"since\":\"" + since + "\",\"until\":\"" + until + "\"}";
              String timeRangeEncoded = URLEncoder.encode(timeRangeJson, StandardCharsets.UTF_8);

            String queryString = "id=" + campaignId
                              + "&idType=campaign"
                              + "&timeRange=" + timeRangeEncoded
                              + "&timeUnit=DAY"
                              + "&fields=clkCnt,impCnt,salesAmt,ctr,avgCpc,convAmt";

            String body = callNaverAdApi(creds, "GET", "/stats", queryString);
              if (body == null || body.isBlank() || "[]".equals(body.trim()) || "{}".equals(body.trim())) return null;

            JsonNode root = objectMapper.readTree(body);
              JsonNode data = root.isArray() ? root : root.path("data");
              if (!data.isArray() || data.size() == 0) return null;

            long totalImpressions = 0, totalClicks = 0, totalConversions = 0;
              BigDecimal totalCost = BigDecimal.ZERO;
              for (JsonNode item : data) {
                            JsonNode stat = item.has("stat") ? item.path("stat") : item;
                            totalImpressions += stat.path("impCnt").asLong(0);
                            totalClicks += stat.path("clkCnt").asLong(0);
                            totalCost = totalCost.add(decimal(stat.path("salesAmt").asText("0")));
                            totalConversions += stat.path("convAmt").asLong(0);
              }

            if (totalImpressions == 0 && totalClicks == 0) return null;

            BigDecimal ctr = totalImpressions > 0
                              ? BigDecimal.valueOf(totalClicks).multiply(BigDecimal.valueOf(100))
                                .divide(BigDecimal.valueOf(totalImpressions), 2, RoundingMode.HALF_UP)
                              : BigDecimal.ZERO;
              BigDecimal avgCpc = totalClicks > 0
                                ? totalCost.divide(BigDecimal.valueOf(totalClicks), 2, RoundingMode.HALF_UP)
                                : BigDecimal.ZERO;

            Map<String, Object> row = new LinkedHashMap<>();
              row.put("impressions", totalImpressions);
              row.put("clicks", totalClicks);
              row.put("cost", totalCost);
              row.put("ctr", ctr);
              row.put("avgCpc", avgCpc);
              row.put("conversions", totalConversions);
              row.put("conversionValue", BigDecimal.ZERO);
              return row;
    }

    private void upsertRow(LocalDate date, String adType, String campaignName, Map<String, Object> row) {
              BigDecimal cost = decimal(row.get("cost"));
              long impressions = longVal(row.get("impressions"));
              long clicks = longVal(row.get("clicks"));
              BigDecimal ctr = decimal(row.get("ctr"));
              BigDecimal avgCpc = decimal(row.get("avgCpc"));
              long conversions = longVal(row.get("conversions"));
              BigDecimal conversionValue = decimal(row.get("conversionValue"));
              BigDecimal roas = cost.compareTo(BigDecimal.ZERO) > 0 && conversionValue.compareTo(BigDecimal.ZERO) > 0
                                ? conversionValue.multiply(BigDecimal.valueOf(100)).divide(cost, 2, RoundingMode.HALF_UP)
                                : BigDecimal.ZERO;
              String keyword = toString(row.getOrDefault("keyword", "-"));
              String adGroupName = toString(row.getOrDefault("adGroupName", "-"));

            jdbcTemplate.update("""
                          INSERT INTO naver_cpc_daily_stats
                                                (date, ad_type, campaign_name, ad_group_name, keyword,
                                                 impressions, clicks, ctr, avg_cpc, cost,
                                                 conversions, conversion_value, roas)
                                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                            ON CONFLICT (date, ad_type, campaign_name, ad_group_name, keyword)
                                            DO UPDATE SET
                                                impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks,
                                                ctr=EXCLUDED.ctr, avg_cpc=EXCLUDED.avg_cpc, cost=EXCLUDED.cost,
                                                conversions=EXCLUDED.conversions, conversion_value=EXCLUDED.conversion_value,
                                                roas=EXCLUDED.roas
                                            """,
                                                date, adType, campaignName, adGroupName, keyword,
                                                impressions, clicks, ctr, avgCpc, cost,
                                                conversions, conversionValue, roas);
    }

    private void upsertCampaignRow(LocalDate date, String adType, String campaignName, Map<String, Object> row) {
              row.putIfAbsent("keyword", "-");
              row.putIfAbsent("adGroupName", "-");
              upsertRow(date, adType, campaignName, row);
    }

    private String callNaverAdApi(IntegrationCredentialService.NaverAdCredentials creds,
                                                                     String method, String path, String queryString) throws Exception {
              String timestamp = String.valueOf(System.currentTimeMillis());
              String signature = signNaverAd(timestamp, method, path, creds.secretKey());
              String url = NAVER_AD_BASE_URL + path;
              if (queryString != null && !queryString.isBlank()) url = url + "?" + queryString;

            HttpRequest request = HttpRequest.newBuilder()
                              .uri(URI.create(url))
                              .header("X-Timestamp", timestamp)
                              .header("X-API-KEY", creds.accessLicense())
                              .header("X-Customer", creds.customerId())
                              .header("X-Signature", signature)
                              .header("Content-Type", "application/json; charset=UTF-8")
                              .GET()
                              .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
              if (response.statusCode() == 200) return response.body();
              if (response.statusCode() == 204) return "[]";

            String respBody = response.body();
              log.warn("[NaverAdSync] API {} {} -> HTTP {} : {}",
                    method, url, response.statusCode(),
                      respBody.substring(0, Math.min(300, respBody.length())));
              throw new RuntimeException("Naver AD API error HTTP " + response.statusCode() + ": " + respBody);
    }

    private String signNaverAd(String timestamp, String method, String path, String secret) throws Exception {
              String message = timestamp + "." + method + "." + path;
              Mac mac = Mac.getInstance("HmacSHA256");
              mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
              byte[] sig = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
              return Base64.getEncoder().encodeToString(sig);
    }

    private boolean isBlank(String v) { return v == null || v.trim().isEmpty(); }
        private String toString(Object v) { if (v == null) return "-"; String s = v.toString().trim(); return s.isEmpty() ? "-" : s; }
        private BigDecimal decimal(Object v) {
                  if (v == null) return BigDecimal.ZERO;
                  if (v instanceof BigDecimal bd) return bd;
                  if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
                  try { return new BigDecimal(v.toString()); } catch (Exception e) { return BigDecimal.ZERO; }
        }
        private long longVal(Object v) {
                  if (v == null) return 0L;
                  if (v instanceof Number n) return n.longValue();
                  try { return new BigDecimal(v.toString()).longValue(); } catch (Exception e) { return 0L; }
        }

    private record CampaignInfo(String id, String name) {}
  }
