네이버검색광고연동동기화서비스네이버검색광고통계주의사항파라미터또는중하나필수사용네이버검색광고날짜형식자동동기화시작자동동기화완료네이버검색광고인증정보가설정되지않았습니다파워링크동기화실패쇼핑검색동기화실패캠페인없음캠페인개발견날짜하나씩집계캠페인오류──캠페인목록조회───────────────────────────────────────────────────────캠페인통계조회─────────────────────────────네이버검색광고필수또는예을인코딩응답또는배열단위이므로모든날짜합계────────────────────────────────────────────────────────────────네이버검색광고호출─────────────────────────────────────────────네이버광고오류──전자서명경로만쿼리스트링제외───────────────────────package naeil.dashboard.service;

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
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 네이버 검색광고 API 연동 동기화 서비스
   * - 파워링크(POWERLINK): 키워드 광고 (campaignType=WEB_SITE)
   * - 쇼핑검색(SHOPPING_SEARCH): 쇼핑검색광고 (campaignType=SHOPPING)
   * 매일 새벽 2시에 전일 성과 데이터를 naver_cpc_daily_stats 테이블에 적재합니다.
   *
   * 네이버 검색광고 통계 API (/stats) 파라미터:
 *   - id: 캠페인ID
   *   - idType: campaign
   *   - startDate: yyyy-MM-dd 형식
   *   - endDate: yyyy-MM-dd 형식
   *   - timeUnit: DAY
   *   - fields: 콤마로 구분된 통계 필드
 */
@Slf4j
  @Service
  @RequiredArgsConstructor
  public class NaverAdSyncService {

    private static final String NAVER_AD_BASE_URL = "https://api.searchad.naver.com";
        private static final Long DEFAULT_COMPANY_ID = 1L;
        // 네이버 검색광고 stats API 날짜 형식: yyyy-MM-dd
    private static final DateTimeFormatter STATS_DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final JdbcTemplate jdbcTemplate;
        private final IntegrationCredentialService credentialService;
        private final ObjectMapper objectMapper;
        private final HttpClient httpClient = HttpClient.newHttpClient();

    // ── 매일 새벽 2시 자동 동기화 ───────────────────────────────────────────
    @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Seoul")
        public void scheduledSync() {
                  log.info("[NaverAdSync] 자동 동기화 시작");
                  LocalDate yesterday = LocalDate.now().minusDays(1);
                  Map<String, Object> result = syncDateRange(yesterday, yesterday);
                  log.info("[NaverAdSync] 자동 동기화 완료: {}", result);
        }

    // ── 수동 동기화 (컨트롤러에서 호출) ─────────────────────────────────────
    @Transactional
        public Map<String, Object> syncDateRange(LocalDate from, LocalDate to) {
                  IntegrationCredentialService.NaverAdCredentials creds =
                                    credentialService.getNaverAdCredentials(DEFAULT_COMPANY_ID);

            if (isBlank(creds.customerId()) || isBlank(creds.accessLicense()) || isBlank(creds.secretKey())) {
                          return Map.of("success", false, "message",
                                                            "네이버 검색광고 API 인증 정보가 설정되지 않았습니다. 설정 > NAVER AD에서 Customer ID, Access License, Secret Key를 입력해주세요.");
            }

            Map<String, Object> result = new LinkedHashMap<>();
                  int totalUpserted = 0;

            // 파워링크 동기화
            try {
                          int n = syncAdType(creds, from, to, "POWERLINK");
                          result.put("powerlink", Map.of("success", true, "upserted", n));
                          totalUpserted += n;
            } catch (Exception e) {
                          log.error("[NaverAdSync] 파워링크 동기화 실패: {}", e.getMessage(), e);
                          result.put("powerlink", Map.of("success", false, "message", e.getMessage()));
            }

            // 쇼핑검색광고 동기화
            try {
                          int n = syncAdType(creds, from, to, "SHOPPING_SEARCH");
                          result.put("shoppingSearch", Map.of("success", true, "upserted", n));
                          totalUpserted += n;
            } catch (Exception e) {
                          log.error("[NaverAdSync] 쇼핑검색 동기화 실패: {}", e.getMessage(), e);
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

            // 1) 캠페인 유형 코드 결정
            String campaignType = "POWERLINK".equals(adType) ? "WEB_SITE" : "SHOPPING";

            // 2) 해당 adType 캠페인 목록 조회
            List<CampaignInfo> campaigns = fetchCampaigns(creds, campaignType);
              if (campaigns.isEmpty()) {
                            log.info("[NaverAdSync] {} 캠페인 없음 (campaignType={})", adType, campaignType);
                            return 0;
              }
              log.info("[NaverAdSync] {} 캠페인 {}개 발견", adType, campaigns.size());

            int upserted = 0;

            // 3) 날짜 범위 순회
            LocalDate cursor = from;
              while (!cursor.isAfter(to)) {
                            String startDate = cursor.format(STATS_DATE_FMT);
                            String endDate = cursor.format(STATS_DATE_FMT);

                  for (CampaignInfo campaign : campaigns) {
                                    try {
                                                          // 4) 캠페인 레포트 통계 조회
                                        List<Map<String, Object>> rows = fetchCampaignReport(creds, campaign.id(), startDate, endDate);
                                                          for (Map<String, Object> row : rows) {
                                                                                    row.put("adGroupName", row.getOrDefault("adGroupName", "-"));
                                                                                    row.put("keyword", row.getOrDefault("keyword", "-"));
                                                                                    upsertRow(cursor, adType, campaign.name(), row);
                                                                                    upserted++;
                                                          }

                                        // 데이터가 없으면 캠페인 단위 집계 시도
                                        if (rows.isEmpty()) {
                                                                  Map<String, Object> summary = fetchCampaignSummary(creds, campaign.id(), startDate, endDate);
                                                                  if (summary != null) {
                                                                                                upsertCampaignRow(cursor, adType, campaign.name(), summary);
                                                                                                upserted++;
                                                                  }
                                        }
                                    } catch (Exception e) {
                                                          log.warn("[NaverAdSync] 캠페인 '{}' {} 날짜 {} 오류: {}", campaign.name(), adType, startDate, e.getMessage());
                                    }
                  }
                            cursor = cursor.plusDays(1);
              }

            return upserted;
    }

    // ── 캠페인 목록 조회 (/ncc/campaigns) ────────────────────────────────────
    private List<CampaignInfo> fetchCampaigns(IntegrationCredentialService.NaverAdCredentials creds,
                                                                                             String campaignType) throws Exception {
              String path = "/ncc/campaigns?campaignTp=" + campaignType;
              String body = callNaverAdApi(creds, "GET", "/ncc/campaigns", "campaignTp=" + campaignType);

            List<CampaignInfo> list = new ArrayList<>();
              JsonNode root = objectMapper.readTree(body == null ? "[]" : body);
              if (root.isArray()) {
                            for (JsonNode node : root) {
                                              String id = node.path("nccCampaignId").asText("");
                                              String name = node.path("name").asText("-");
                                              if (!id.isBlank()) {
                                                                    list.add(new CampaignInfo(id, name));
                                              }
                            }
              }
              return list;
    }

    // ── 캠페인 레포트 통계 조회 (/stats) ─────────────────────────────────────
    // 네이버 검색광고 통계 API: GET /stats
    // 필수 파라미터: id, idType, startDate(yyyy-MM-dd), endDate(yyyy-MM-dd), timeUnit
    private List<Map<String, Object>> fetchCampaignReport(IntegrationCredentialService.NaverAdCredentials creds,
                                                                                                                     String campaignId,
                                                                                                                     String startDate, String endDate) throws Exception {
              String queryString = "id=" + campaignId
                                + "&idType=campaign"
                                + "&startDate=" + startDate
                                + "&endDate=" + endDate
                                + "&timeUnit=DAY"
                                + "&fields=clkCnt,impCnt,salesAmt,ctr,avgCpc,ror,convAmt";
              String body = callNaverAdApi(creds, "GET", "/stats", queryString);

            List<Map<String, Object>> rows = new ArrayList<>();
              if (body == null || body.isBlank() || "[]".equals(body.trim())) return rows;

            JsonNode root = objectMapper.readTree(body);
              // /stats 응답 구조: {"data":[{"stat":{...},"impressions":...,"clicks":...}]} 또는 배열
            JsonNode data = root.isArray() ? root : root.path("data");
              if (!data.isArray()) return rows;

            for (JsonNode item : data) {
                          // stat 하위 노드 또는 직접 노드 처리
                  JsonNode stat = item.has("stat") ? item.path("stat") : item;

                  long impressions = stat.path("impCnt").asLong(item.path("impCnt").asLong(0));
                          long clicks = stat.path("clkCnt").asLong(item.path("clkCnt").asLong(0));

                  // 노출과 클릭이 모두 0이면 스킵
                  if (impressions == 0 && clicks == 0) continue;

                  Map<String, Object> row = new LinkedHashMap<>();
                          row.put("impressions", impressions);
                          row.put("clicks", clicks);
                          row.put("cost", decimal(stat.path("salesAmt").asText(item.path("salesAmt").asText("0"))));
                          row.put("ctr", decimal(stat.path("ctr").asText(item.path("ctr").asText("0"))));
                          row.put("avgCpc", decimal(stat.path("avgCpc").asText(item.path("avgCpc").asText("0"))));
                          row.put("conversions", stat.path("convAmt").asLong(item.path("convAmt").asLong(0)));
                          row.put("conversionValue", decimal(stat.path("ror").asText(item.path("ror").asText("0"))));
                          row.put("keyword", item.path("keyword").asText("-"));
                          row.put("adGroupName", item.path("adGroupName").asText("-"));
                          rows.add(row);
            }
              return rows;
    }

    // ── 캠페인 단위 집계 (키워드 없을 때 fallback) ───────────────────────────
    private Map<String, Object> fetchCampaignSummary(IntegrationCredentialService.NaverAdCredentials creds,
                                                                                                           String campaignId,
                                                                                                           String startDate, String endDate) throws Exception {
              String queryString = "id=" + campaignId
                                + "&idType=campaign"
                                + "&startDate=" + startDate
                                + "&endDate=" + endDate
                                + "&timeUnit=TOTAL"
                                + "&fields=clkCnt,impCnt,salesAmt,ctr,avgCpc,convAmt";
              String body = callNaverAdApi(creds, "GET", "/stats", queryString);
              if (body == null || body.isBlank() || "[]".equals(body.trim())) return null;

            JsonNode root = objectMapper.readTree(body);
              JsonNode data = root.isArray() ? root : root.path("data");
              if (!data.isArray() || data.size() == 0) return null;

            JsonNode item = data.get(0);
              JsonNode stat = item.has("stat") ? item.path("stat") : item;

            long impressions = stat.path("impCnt").asLong(item.path("impCnt").asLong(0));
              long clicks = stat.path("clkCnt").asLong(item.path("clkCnt").asLong(0));
              if (impressions == 0 && clicks == 0) return null;

            Map<String, Object> row = new LinkedHashMap<>();
              row.put("impressions", impressions);
              row.put("clicks", clicks);
              row.put("cost", decimal(stat.path("salesAmt").asText(item.path("salesAmt").asText("0"))));
              row.put("ctr", decimal(stat.path("ctr").asText(item.path("ctr").asText("0"))));
              row.put("avgCpc", decimal(stat.path("avgCpc").asText(item.path("avgCpc").asText("0"))));
              row.put("conversions", stat.path("convAmt").asLong(item.path("convAmt").asLong(0)));
              row.put("conversionValue", BigDecimal.ZERO);
              return row;
    }

    // ── DB upsert (키워드 단위) ──────────────────────────────────────────────
    private void upsertRow(LocalDate date, String adType, String campaignName, Map<String, Object> row) {
              BigDecimal cost = decimal(row.get("cost"));
              long impressions = longVal(row.get("impressions"));
              long clicks = longVal(row.get("clicks"));
              BigDecimal ctr = decimal(row.get("ctr"));
              BigDecimal avgCpc = decimal(row.get("avgCpc"));
              long conversions = longVal(row.get("conversions"));
              BigDecimal conversionValue = decimal(row.get("conversionValue"));
              BigDecimal roas = cost.compareTo(BigDecimal.ZERO) > 0
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
                                                impressions      = EXCLUDED.impressions,
                                                clicks           = EXCLUDED.clicks,
                                                ctr              = EXCLUDED.ctr,
                                                avg_cpc          = EXCLUDED.avg_cpc,
                                                cost             = EXCLUDED.cost,
                                                conversions      = EXCLUDED.conversions,
                                                conversion_value = EXCLUDED.conversion_value,
                                                roas             = EXCLUDED.roas
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

    // ── 네이버 검색광고 API 호출 ─────────────────────────────────────────────
    // path: 경로 (예: /ncc/campaigns, /stats)
    // queryString: URL 인코딩된 쿼리 파라미터 (예: id=xxx&idType=campaign&...)
    private String callNaverAdApi(IntegrationCredentialService.NaverAdCredentials creds,
                                                                     String method, String path, String queryString) throws Exception {
              String timestamp = String.valueOf(System.currentTimeMillis());
              String signature = signNaverAd(timestamp, method, path, creds.secretKey());

            String url = NAVER_AD_BASE_URL + path;
              if (queryString != null && !queryString.isBlank()) {
                            url = url + "?" + queryString;
              }

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                              .uri(URI.create(url))
                              .header("X-Timestamp", timestamp)
                              .header("X-API-KEY", creds.accessLicense())
                              .header("X-Customer", creds.customerId())
                              .header("X-Signature", signature)
                              .header("Content-Type", "application/json; charset=UTF-8");

            builder.GET();

            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                          return response.body();
            }
              if (response.statusCode() == 204) {
                            return "[]";
              }
              String respBody = response.body();
              log.warn("[NaverAdSync] API {} {} -> HTTP {} body: {}",
                    method, url, response.statusCode(),
                      respBody.substring(0, Math.min(300, respBody.length())));
              throw new RuntimeException("네이버 광고 API 오류 HTTP " + response.statusCode() + ": " + respBody);
    }

    // ── HmacSHA256 전자서명 ──────────────────────────────────────────────────
    // 서명 메시지: timestamp.METHOD.path (경로만, 쿼리스트링 제외)
    private String signNaverAd(String timestamp, String method, String path, String secret) throws Exception {
              String message = timestamp + "." + method + "." + path;
              Mac mac = Mac.getInstance("HmacSHA256");
              mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
              byte[] sig = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
              return Base64.getEncoder().encodeToString(sig);
    }

    private boolean isBlank(String value) {
              return value == null || value.trim().isEmpty();
    }

    private String toString(Object value) {
              if (value == null) return "-";
              String s = value.toString().trim();
              return s.isEmpty() ? "-" : s;
    }

    private BigDecimal decimal(Object value) {
              if (value == null) return BigDecimal.ZERO;
              if (value instanceof BigDecimal bd) return bd;
              if (value instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
              try { return new BigDecimal(value.toString()); } catch (Exception e) { return BigDecimal.ZERO; }
    }

    private long longVal(Object value) {
              if (value == null) return 0L;
              if (value instanceof Number n) return n.longValue();
              try { return new BigDecimal(value.toString()).longValue(); } catch (Exception e) { return 0L; }
    }

    private record CampaignInfo(String id, String name) {}
  }
