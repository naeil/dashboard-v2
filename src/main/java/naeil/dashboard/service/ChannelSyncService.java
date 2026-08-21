package naeil.dashboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.entity.ChannelApiCredential;
import naeil.dashboard.entity.OnlineChannelPerformance;
import naeil.dashboard.repository.ChannelApiCredentialRepository;
import naeil.dashboard.repository.OnlineChannelPerformanceRepository;
import org.mindrot.jbcrypt.BCrypt;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.InetSocketAddress;
import java.net.ProxySelector;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChannelSyncService {

    private final ChannelApiCredentialRepository credentialRepo;
    private final OnlineChannelPerformanceRepository onlineRepo;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private volatile HttpClient naverHttpClient;

    // ── 네이버 커머스API 전용 클라이언트 ──────────────────────────────────────
    // 네이버는 API 호출 IP를 최대 3개까지만 허용 → 고정 IP 프록시(VPS) 경유가 필요하다.
    // 환경변수 NAVER_PROXY_HOST / NAVER_PROXY_PORT 가 설정되면 네이버 호출만 프록시를 통과하고,
    // 미설정 시 기존과 동일하게 직접 호출한다 (다른 채널 API는 항상 직접 호출).
    private HttpClient naverClient() {
        HttpClient client = naverHttpClient;
        if (client == null) {
            HttpClient.Builder builder = HttpClient.newBuilder();
            String proxyHost = System.getenv("NAVER_PROXY_HOST");
            String proxyPort = System.getenv("NAVER_PROXY_PORT");
            if (proxyHost != null && !proxyHost.isBlank()) {
                int port = 8888;
                try { port = Integer.parseInt(proxyPort.trim()); } catch (Exception ignored) {}
                builder.proxy(ProxySelector.of(new InetSocketAddress(proxyHost.trim(), port)));
                log.info("[NaverProxy] 네이버 API 호출을 고정 IP 프록시 {}:{} 경유로 전환", proxyHost.trim(), port);
            }
            client = builder.build();
            naverHttpClient = client;
        }
        return client;
    }

    private HttpResponse<String> sendNaver(HttpRequest request) throws Exception {
        for (int attempt = 0; ; attempt++) {
            naverThrottle();
            HttpResponse<String> response = naverClient().send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 429 && attempt < 4) {
                long backoffMs = 1000L * (1L << attempt); // 1s, 2s, 4s, 8s
                log.warn("[NaverThrottle] 429 rate limit — {}ms 대기 후 재시도 ({}차)", backoffMs, attempt + 1);
                Thread.sleep(backoffMs);
                continue;
            }
            return response;
        }
    }

    // 네이버 커머스API 호출 간 최소 간격 보장 (초당 호출 제한 대응)
    private long lastNaverCallAt = 0L;

    private synchronized void naverThrottle() {
        long wait = 400 - (System.currentTimeMillis() - lastNaverCallAt);
        if (wait > 0) {
            try {
                Thread.sleep(wait);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        lastNaverCallAt = System.currentTimeMillis();
    }

    @Scheduled(cron = "0 0 3 * * *", zone = "Asia/Seoul")
    public void scheduledDailySync() {
        log.info("[ChannelSync] Starting scheduled daily sync...");
        syncAllChannels(YearMonth.now().toString());
        syncAllInquiries();
        try {
            LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
            syncDailyAll(today.minusDays(3), today);
        } catch (Exception e) {
            log.error("[ChannelSync] Scheduled daily sales sync failed: {}", e.getMessage(), e);
        }
        log.info("[ChannelSync] Scheduled daily sync completed.");
    }

    @Transactional
    public Map<String, Object> syncAllChannels(String month) {
        String targetMonth = (month == null || month.isEmpty()) ? YearMonth.now().toString() : month;
        Map<String, Object> results = new LinkedHashMap<>();
        List<ChannelApiCredential> credentials = credentialRepo.findAllByOrderByChannelTypeAsc();
        for (ChannelApiCredential cred : credentials) {
            if (!Boolean.TRUE.equals(cred.getIsActive())) continue;
            if (cred.getCredentialKey1() == null || cred.getCredentialKey1().isBlank()) continue;
            Map<String, Object> result = syncChannel(cred, targetMonth);
            results.put(cred.getChannelType(), result);
        }
        return results;
    }

    @Transactional
    public Map<String, Object> syncChannel(String channelType, String month) {
        ChannelApiCredential cred = credentialRepo.findByChannelType(channelType)
                .orElseThrow(() -> new RuntimeException("Credentials not found for: " + channelType));
        String targetMonth = (month == null || month.isEmpty()) ? YearMonth.now().toString() : month;
        return syncChannel(cred, targetMonth);
    }

    private Map<String, Object> syncChannel(ChannelApiCredential cred, String targetMonth) {
        Map<String, Object> result = new HashMap<>();
        try {
            SyncResult syncResult;
            switch (cred.getChannelType().toUpperCase()) {
                case "SMARTSTORE":
                case "SMARTSTORE_2": syncResult = syncSmartStore(cred, targetMonth); break;
                case "COUPANG":    syncResult = syncCoupang(cred, targetMonth);    break;
                case "IMWEB":      syncResult = syncImweb(cred, targetMonth);      break;
                case "ELEVENST":   syncResult = syncElevenStMonthly(cred, targetMonth); break;
                default: syncResult = new SyncResult(false, "Unknown channel type: " + cred.getChannelType(), 0, 0);
            }
            cred.setLastSyncAt(LocalDateTime.now());
            cred.setLastSyncStatus(syncResult.success() ? "SUCCESS" : "FAILED");
            cred.setLastSyncMessage(syncResult.message());
            credentialRepo.save(cred);
            result.put("success", syncResult.success());
            result.put("message", syncResult.message());
            result.put("salesAmount", syncResult.salesAmount());
            result.put("orderCount", syncResult.orderCount());
        } catch (Exception e) {
            log.error("[ChannelSync] Error syncing {}: {}", cred.getChannelType(), e.getMessage(), e);
            cred.setLastSyncAt(LocalDateTime.now());
            cred.setLastSyncStatus("ERROR");
            cred.setLastSyncMessage(e.getMessage());
            credentialRepo.save(cred);
            result.put("success", false);
            result.put("message", "Error: " + e.getMessage());
        }
        return result;
    }

    // ── SmartStore: BCrypt 전자서명 방식 (네이버 공식 문서 준수) ────────────────
    private SyncResult syncSmartStore(ChannelApiCredential cred, String targetMonth) throws Exception {
        String clientId = cred.getCredentialKey1();
        String clientSecret = cred.getCredentialKey2();

        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            return new SyncResult(false, "SmartStore clientId/clientSecret not configured", 0, 0);
        }

        String accessToken = getNaverAccessToken(clientId, clientSecret);
        if (accessToken == null) {
            return new SyncResult(false, "SmartStore auth failed", 0, 0);
        }

        YearMonth ym = YearMonth.parse(targetMonth);
        String startDate = ym.atDay(1).toString() + "T00:00:00";
        String endDate = ym.atEndOfMonth().toString() + "T23:59:59";

        String ordersUrl = String.format(
                "https://api.commerce.naver.com/external/v1/pay-order/seller/orders/last-changed-statuses" +
                        "?lastChangedFrom=%s&lastChangedTo=%s&page=1&pageSize=300", startDate, endDate);

        HttpRequest ordersRequest = HttpRequest.newBuilder()
                .uri(URI.create(ordersUrl))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .GET().build();

        HttpResponse<String> ordersResponse = sendNaver(ordersRequest);

        long totalSales = 0L;
        int orderCount = 0;

        if (ordersResponse.statusCode() == 200) {
            JsonNode ordersJson = objectMapper.readTree(ordersResponse.body());
            JsonNode data = ordersJson.path("data");
            if (data.isArray()) {
                for (JsonNode order : data) {
                    String status = order.path("orderStatus").asText("");
                    if (status.equals("PAYED") || status.equals("DELIVERED") ||
                            status.equals("PURCHASE_DECIDED") || status.equals("DISPATCHED")) {
                        totalSales += order.path("productOrderAmount").path("totalPaymentAmount").asLong(0);
                        orderCount++;
                    }
                }
            }
        } else {
            log.warn("[SmartStore] Orders API {} | body: {}", ordersResponse.statusCode(), ordersResponse.body());
        }

        saveOrUpdateChannelPerformance(displayName(cred.getChannelType()), targetMonth, totalSales, orderCount, cred.getChannelType().toUpperCase());
        return new SyncResult(true, String.format("SmartStore sync OK: %d orders, %d won", orderCount, totalSales), totalSales, orderCount);
    }

    // ── SmartStore CS 문의 동기화 ─────────────────────────────────────────────
    public Map<String, Object> syncAllInquiries() {
        Map<String, Object> results = new LinkedHashMap<>();
        List<ChannelApiCredential> credentials = credentialRepo.findAllByOrderByChannelTypeAsc();
        for (ChannelApiCredential cred : credentials) {
            if (!Boolean.TRUE.equals(cred.getIsActive())) continue;
            if (!cred.getChannelType().toUpperCase().startsWith("SMARTSTORE")) continue;
            if (cred.getCredentialKey1() == null || cred.getCredentialKey1().isBlank()) continue;
            try {
                int synced = syncSmartStoreInquiries(cred);
                results.put(cred.getChannelType(), Map.of("success", true, "synced", synced));
                log.info("[InquirySync] {}: {} inquiries synced", cred.getChannelType(), synced);
            } catch (Exception e) {
                log.error("[InquirySync] {} error: {}", cred.getChannelType(), e.getMessage(), e);
                results.put(cred.getChannelType(), Map.of("success", false, "message", e.getMessage()));
            }
        }
        return results;
    }

    private int syncSmartStoreInquiries(ChannelApiCredential cred) throws Exception {
        String clientId = cred.getCredentialKey1();
        String clientSecret = cred.getCredentialKey2();

        String accessToken = getNaverAccessToken(clientId, clientSecret);
        if (accessToken == null) throw new RuntimeException("Failed to get Naver access token");

        int totalSynced = 0;

        // 1) 상품 문의 (GET /v1/contents/qnas)
        totalSynced += fetchAndSaveNaverQnas(accessToken, cred);

        // 2) 구매자 문의 (GET /v1/pay-user/inquiries)
        totalSynced += fetchAndSaveNaverPayUserInquiries(accessToken, cred);

        return totalSynced;
    }

    private int fetchAndSaveNaverQnas(String accessToken, ChannelApiCredential cred) throws Exception {
        String url = "https://api.commerce.naver.com/external/v1/contents/qnas" +
                "?page=1&pageSize=100&answered=false";

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + accessToken)
                .GET().build();

        HttpResponse<String> resp = sendNaver(req);
        log.info("[InquirySync] QnA API status={} body(앞200)={}", resp.statusCode(),
                resp.body().substring(0, Math.min(200, resp.body().length())));

        if (resp.statusCode() != 200) {
            log.warn("[InquirySync] QnA API error {}: {}", resp.statusCode(), resp.body());
            return 0;
        }

        JsonNode root = objectMapper.readTree(resp.body());
        JsonNode contents = root.path("contents");
        if (!contents.isArray()) return 0;

        int count = 0;
        for (JsonNode q : contents) {
            String externalId = q.path("questionId").asText(null);
            if (externalId == null || externalId.isBlank()) continue;

            String customerName = q.path("writerName").asText("스마트스토어 고객");
            String message = q.path("content").asText("");
            String inquiryType = q.path("questionType").asText("GENERAL");
            boolean answered = q.path("answered").asBoolean(false);
            String status = answered ? "DONE" : "UNANSWERED";
            String receivedAt = q.path("regDate").asText(null);

            upsertInquiry(1L, "SMARTSTORE", externalId, customerName, inquiryType,
                    message, status, null, receivedAt, false,
                    "https://sell.smartstore.naver.com/#/qna/list");
            count++;
        }
        return count;
    }

    private int fetchAndSaveNaverPayUserInquiries(String accessToken, ChannelApiCredential cred) throws Exception {
        String url = "https://api.commerce.naver.com/external/v1/pay-user/inquiries" +
                "?page=1&pageSize=100";

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + accessToken)
                .GET().build();

        HttpResponse<String> resp = sendNaver(req);
        log.info("[InquirySync] PayUserInquiry API status={} body(앞200)={}", resp.statusCode(),
                resp.body().substring(0, Math.min(200, resp.body().length())));

        if (resp.statusCode() != 200) {
            log.warn("[InquirySync] PayUserInquiry API error {}: {}", resp.statusCode(), resp.body());
            return 0;
        }

        JsonNode root = objectMapper.readTree(resp.body());
        JsonNode inquiries = root.path("inquiries");
        if (!inquiries.isArray()) inquiries = root.path("contents");
        if (!inquiries.isArray()) return 0;

        int count = 0;
        for (JsonNode inq : inquiries) {
            String externalId = "pui-" + inq.path("inquiryNo").asText(null);
            if (externalId.equals("pui-null")) continue;

            String customerName = inq.path("memberId").asText("구매자");
            String message = inq.path("content").asText("");
            String inquiryType = inq.path("inquiryType").asText("GENERAL");
            boolean answered = !inq.path("answerContent").asText("").isBlank();
            String status = answered ? "DONE" : "UNANSWERED";
            String receivedAt = inq.path("regDate").asText(null);
            boolean urgent = inq.path("deliveryDelay").asBoolean(false);

            upsertInquiry(1L, "SMARTSTORE", externalId, customerName, inquiryType,
                    message, status, null, receivedAt, urgent,
                    "https://sell.smartstore.naver.com/#/inquiry/list");
            count++;
        }
        return count;
    }

    private void upsertInquiry(Long companyId, String channel, String externalId,
                                String customerName, String inquiryType, String message,
                                String status, String assignedTo, String receivedAt,
                                boolean urgent, String sourceUrl) {
        String sql = """
                INSERT INTO executive_customer_inquiry
                    (company_id, channel, external_id, customer_name, inquiry_type,
                     message, status, assigned_to, received_at, urgent, source_url, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::timestamptz, ?, ?, NOW())
                ON CONFLICT (company_id, channel, external_id)
                DO UPDATE SET
                    customer_name = EXCLUDED.customer_name,
                    message       = EXCLUDED.message,
                    status        = CASE
                        WHEN executive_customer_inquiry.status = 'DONE' THEN 'DONE'
                        ELSE EXCLUDED.status END,
                    urgent        = EXCLUDED.urgent,
                    updated_at    = NOW()
                """;
        jdbcTemplate.update(sql,
                companyId, channel, externalId, customerName, inquiryType,
                message, status, assignedTo, receivedAt, urgent, sourceUrl);
    }

    // ── 네이버 OAuth 토큰 발급 (공통) ─────────────────────────────────────────
    private String getNaverAccessToken(String clientId, String clientSecret) throws Exception {
        String tokenUrl = "https://api.commerce.naver.com/external/v1/oauth2/token";
        long timestamp = System.currentTimeMillis();
        String sign = generateNaverSign(clientId, clientSecret, timestamp);

        String tokenBody = "client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
                + "&timestamp=" + timestamp
                + "&client_secret_sign=" + URLEncoder.encode(sign, StandardCharsets.UTF_8)
                + "&grant_type=client_credentials"
                + "&type=SELF";

        log.info("[Naver Token Request] client_id(앞6자리)={} | timestamp={}",
                clientId.substring(0, Math.min(6, clientId.length())), timestamp);

        HttpRequest tokenRequest = HttpRequest.newBuilder()
                .uri(URI.create(tokenUrl))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(tokenBody))
                .build();

        HttpResponse<String> tokenResponse = sendNaver(tokenRequest);
        log.info("[Naver Token] HTTP={} body(앞100)={}", tokenResponse.statusCode(),
                tokenResponse.body().substring(0, Math.min(100, tokenResponse.body().length())));

        if (tokenResponse.statusCode() != 200) {
            log.error("[Naver API Error] HTTP={} body={}", tokenResponse.statusCode(), tokenResponse.body());
            String hint = "";
            try {
                JsonNode err = objectMapper.readTree(tokenResponse.body());
                String code = err.path("code").asText("");
                String msg = err.path("message").asText("");
                if ("GW.IP_NOT_ALLOWED".equals(code)) {
                    hint = " — 커머스API센터 애플리케이션의 'API 호출 IP'에 서버 IP(74.220.52.0/24, 74.220.60.0/24)를 등록하세요";
                }
                throw new RuntimeException("네이버 인증 실패 [" + code + "] " + msg + hint);
            } catch (RuntimeException re) {
                throw re;
            } catch (Exception parseError) {
                throw new RuntimeException("네이버 인증 실패 HTTP " + tokenResponse.statusCode());
            }
        }

        JsonNode tokenJson = objectMapper.readTree(tokenResponse.body());
        String accessToken = tokenJson.path("access_token").asText();
        if (accessToken == null || accessToken.isBlank()) return null;

        log.info("[Naver Token] 발급 성공. expires_in={}s", tokenJson.path("expires_in").asInt());
        return accessToken;
    }

    private SyncResult syncCoupang(ChannelApiCredential cred, String targetMonth) throws Exception {
        String accessKey = cred.getCredentialKey1();
        String secretKey = cred.getCredentialKey2();
        if (accessKey == null || accessKey.isBlank() || secretKey == null || secretKey.isBlank()) {
            return new SyncResult(false, "Coupang accessKey/secretKey not configured", 0, 0);
        }
        YearMonth ym = YearMonth.parse(targetMonth);
        String startDate = ym.atDay(1).format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'00:00:00"));
        String endDate = ym.atEndOfMonth().format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'23:59:59"));
        String method = "GET";
        String path = "/v2/providers/seller_api/apis/api/v4/seller/ordersheets";
        String query = String.format("?createdAtFrom=%s&createdAtTo=%s&status=INSTRUCT&pageSize=100&pageNum=1", startDate, endDate);
        String datetime = new java.text.SimpleDateFormat("yyMMdd'T'HHmmss'Z'").format(new java.util.Date());
        String message = datetime + method + path + query;
        String signature = hmacSha256Hex(message, secretKey);
        String authorization = String.format("CEA algorithm=HmacSHA256, access-key=%s, signed-date=%s, signature=%s", accessKey, datetime, signature);
        String url = "https://api-gateway.coupang.com" + path + query;
        HttpRequest request = HttpRequest.newBuilder().uri(URI.create(url))
                .header("Authorization", authorization).header("Content-Type", "application/json").GET().build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        long totalSales = 0L; int orderCount = 0;
        if (response.statusCode() == 200) {
            JsonNode json = objectMapper.readTree(response.body());
            JsonNode data = json.path("data");
            if (data.isArray()) { for (JsonNode order : data) { totalSales += order.path("totalPrice").asLong(0); orderCount++; } }
        } else { log.warn("[Coupang] API error {}: {}", response.statusCode(), response.body()); }
        saveOrUpdateChannelPerformance("쿠팡", targetMonth, totalSales, orderCount, "COUPANG");
        return new SyncResult(true, String.format("Coupang sync OK: %d orders, %d won", orderCount, totalSales), totalSales, orderCount);
    }

    private SyncResult syncImweb(ChannelApiCredential cred, String targetMonth) throws Exception {
        String apiKey = cred.getCredentialKey1();
        if (apiKey == null || apiKey.isBlank()) return new SyncResult(false, "Imweb apiKey not configured", 0, 0);
        String tokenUrl = "https://api.imweb.me/v2/auth";
        String tokenBody = "{\"key\":\"" + apiKey + "\",\"secret\":\"" + (cred.getCredentialKey2() != null ? cred.getCredentialKey2() : "") + "\"}";
        HttpRequest tokenReq = HttpRequest.newBuilder().uri(URI.create(tokenUrl))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(tokenBody)).build();
        HttpResponse<String> tokenResp = httpClient.send(tokenReq, HttpResponse.BodyHandlers.ofString());
        if (tokenResp.statusCode() != 200) { log.warn("[Imweb] Auth error {}: {}", tokenResp.statusCode(), tokenResp.body()); return new SyncResult(false, "Imweb auth failed: HTTP " + tokenResp.statusCode(), 0, 0); }
        JsonNode tokenJson = objectMapper.readTree(tokenResp.body());
        String accessToken = tokenJson.path("data").path("access_token").asText();
        if (accessToken == null || accessToken.isBlank()) return new SyncResult(false, "Imweb: access_token not found", 0, 0);
        YearMonth ym = YearMonth.parse(targetMonth);
        long startTs = ym.atDay(1).atStartOfDay().toEpochSecond(java.time.ZoneOffset.UTC);
        long endTs = ym.atEndOfMonth().atTime(23,59,59).toEpochSecond(java.time.ZoneOffset.UTC);
        String ordersUrl = String.format("https://api.imweb.me/v2/shop/orders?order_status=pay_done&date_type=order_date&start_date=%d&end_date=%d", startTs, endTs);
        HttpRequest ordersReq = HttpRequest.newBuilder().uri(URI.create(ordersUrl)).header("access-token", accessToken).GET().build();
        HttpResponse<String> ordersResp = httpClient.send(ordersReq, HttpResponse.BodyHandlers.ofString());
        long totalSales = 0L; int orderCount = 0;
        if (ordersResp.statusCode() == 200) {
            JsonNode data = objectMapper.readTree(ordersResp.body()).path("data").path("list");
            if (data.isArray()) { for (JsonNode o : data) { totalSales += o.path("order_price").asLong(0); orderCount++; } }
        } else { log.warn("[Imweb] Orders error {}: {}", ordersResp.statusCode(), ordersResp.body()); }
        saveOrUpdateChannelPerformance("자사몰", targetMonth, totalSales, orderCount, "IMWEB");
        return new SyncResult(true, String.format("Imweb sync OK: %d orders, %d won", orderCount, totalSales), totalSales, orderCount);
    }

    @Transactional
    protected void saveOrUpdateChannelPerformance(String channelName, String targetMonth, long salesAmount, int orderCount, String syncSource) {
        List<OnlineChannelPerformance> existing = onlineRepo.findByPerformanceMonthAndChannelName(targetMonth, channelName);
        OnlineChannelPerformance perf;
        if (!existing.isEmpty()) { perf = existing.get(0); }
        else { perf = OnlineChannelPerformance.builder().performanceMonth(targetMonth).channelName(channelName).incentiveEligible(true).build(); }
        perf.setSalesAmount(salesAmount); perf.setSyncSource(syncSource); perf.recalculateOperatingProfit();
        onlineRepo.save(perf);
        log.info("[ChannelSync] Saved {} for {}: {} won, {} orders", channelName, targetMonth, salesAmount, orderCount);
    }

    @Transactional(readOnly = true)
    public List<ChannelApiCredential> getAllCredentials() { return credentialRepo.findAllByOrderByChannelTypeAsc(); }

    @Transactional
    public ChannelApiCredential saveCredentials(String channelType, String key1, String key2, String key3, String key4, Boolean isActive) {
        ChannelApiCredential cred = credentialRepo.findByChannelType(channelType.toUpperCase())
                .orElse(ChannelApiCredential.builder().channelType(channelType.toUpperCase()).build());
        if (key1 != null) cred.setCredentialKey1(key1.trim()); if (key2 != null) cred.setCredentialKey2(key2.trim());
        if (key3 != null) cred.setCredentialKey3(key3.trim()); if (key4 != null) cred.setCredentialKey4(key4.trim());
        if (isActive != null) cred.setIsActive(isActive);
        return credentialRepo.save(cred);
    }

    // ── 네이버 전자서명: BCrypt(clientId_timestamp, clientSecret) → Base64(URL-safe) ──
    private String generateNaverSign(String clientId, String clientSecret, long timestamp) {
        String password = clientId + "_" + timestamp;
        try {
            String hashed = BCrypt.hashpw(password, clientSecret);
            return Base64.getUrlEncoder().encodeToString(hashed.getBytes(StandardCharsets.UTF_8));
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Client Secret 형식 오류 — 커머스API센터에서 발급된 '$2a$'로 시작하는 Client Secret인지 확인하세요 (" + e.getMessage() + ")");
        }
    }

    // HmacSHA256 → HEX (쿠팡 전용)
    private String hmacSha256Hex(String message, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] hash = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) { String h = Integer.toHexString(0xff & b); if (h.length() == 1) sb.append('0'); sb.append(h); }
        return sb.toString();
    }

    // ── 네이버 CS 문의 답변 등록 ──────────────────────────────────────────────
    public Map<String, Object> answerInquiry(Long inquiryId, String answerContent) throws Exception {
        // 1) DB에서 해당 문의 조회 (external_id, channel 확인)
        var rows = jdbcTemplate.queryForList(
                "SELECT id, channel, external_id, status FROM executive_customer_inquiry WHERE id = ?",
                inquiryId);
        if (rows.isEmpty()) throw new RuntimeException("문의를 찾을 수 없습니다: " + inquiryId);

        var row = rows.get(0);
        String channel = (String) row.get("channel");
        String externalId = (String) row.get("external_id");

        // 2) 채널별 실제 API 답변 등록
        if ("SMARTSTORE".equals(channel)) {
            ChannelApiCredential cred = credentialRepo.findByChannelType("SMARTSTORE")
                    .orElseThrow(() -> new RuntimeException("SmartStore credentials not found"));
            if (Boolean.TRUE.equals(cred.getIsActive()) &&
                    cred.getCredentialKey1() != null && !cred.getCredentialKey1().isBlank()) {
                postNaverAnswer(cred, externalId, answerContent);
            }
        }

        // 3) DB 상태 업데이트 (DONE + answered_at)
        jdbcTemplate.update("""
                UPDATE executive_customer_inquiry
                SET status = 'DONE', answered_at = NOW(), updated_at = NOW()
                WHERE id = ?
                """, inquiryId);

        log.info("[AnswerInquiry] 답변 등록 완료 - id={}, channel={}, externalId={}", inquiryId, channel, externalId);
        return Map.of("success", true, "inquiryId", inquiryId, "channel", channel);
    }

    private void postNaverAnswer(ChannelApiCredential cred, String externalId, String answerContent) throws Exception {
        // sample- 로 시작하는 더미 데이터는 실제 API 호출 스킵
        if (externalId != null && externalId.startsWith("sample-")) {
            log.info("[AnswerInquiry] 샘플 데이터 - Naver API 호출 스킵 (externalId={})", externalId);
            return;
        }
        // pui- 접두사는 구매자 문의 (pay-merchant/inquiries)
        // 나머지는 상품 문의 (contents/qnas)
        String accessToken = getNaverAccessToken(cred.getCredentialKey1(), cred.getCredentialKey2());
        if (accessToken == null) throw new RuntimeException("네이버 토큰 발급 실패");

        if (externalId != null && externalId.startsWith("pui-")) {
            // 구매자 문의 답변: POST /v1/pay-merchant/inquiries/{inquiryNo}/answer
            String inquiryNo = externalId.substring(4);
            String url = "https://api.commerce.naver.com/external/v1/pay-merchant/inquiries/" + inquiryNo + "/answer";
            String body = "{\"content\":\"" + answerContent.replace("\"", "\\\"") + "\"}";
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            HttpResponse<String> resp = sendNaver(req);
            log.info("[AnswerInquiry] pay-merchant answer HTTP={} body={}", resp.statusCode(), resp.body());
            if (resp.statusCode() >= 300) {
                throw new RuntimeException("네이버 구매자 문의 답변 실패: HTTP " + resp.statusCode() + " | " + resp.body());
            }
        } else {
            // 상품 문의 답변: PUT /v1/contents/qnas/{questionId}
            String url = "https://api.commerce.naver.com/external/v1/contents/qnas/" + externalId;
            String body = "{\"answer\":\"" + answerContent.replace("\"", "\\\"") + "\"}";
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Content-Type", "application/json")
                    .method("PUT", HttpRequest.BodyPublishers.ofString(body)).build();
            HttpResponse<String> resp = sendNaver(req);
            log.info("[AnswerInquiry] qna answer HTTP={} body={}", resp.statusCode(), resp.body());
            if (resp.statusCode() >= 300) {
                throw new RuntimeException("네이버 상품 문의 답변 실패: HTTP " + resp.statusCode() + " | " + resp.body());
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 일별 매출 수집 → field_sales_entry 적재 (CFO·CEO 대시보드 / 실무 입력 화면 연동)
    // - created_by='API_SYNC' 행만 갱신하므로 직원 수기 입력과 충돌하지 않는다.
    //   (단, 자동수집 채널은 같은 채널명으로 수기 입력하지 않을 것 — 이중집계 방지)
    // ═══════════════════════════════════════════════════════════════════════════

    private static final Long DEFAULT_COMPANY_ID = 1L;
    private static final String SYNC_CREATED_BY = "API_SYNC";
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final Map<String, String> CHANNEL_DISPLAY_NAMES = Map.of(
            "SMARTSTORE", "스마트스토어(하이프리)",
            "SMARTSTORE_2", "스마트스토어(국민한상)",
            "COUPANG", "쿠팡",
            "IMWEB", "자사몰",
            "ELEVENST", "11번가");

    private String displayName(String channelType) {
        return CHANNEL_DISPLAY_NAMES.getOrDefault(channelType.toUpperCase(), channelType);
    }

    public Map<String, Object> syncDailyAll(LocalDate from, LocalDate to) {
        Map<String, Object> results = new LinkedHashMap<>();
        for (ChannelApiCredential cred : credentialRepo.findAllByOrderByChannelTypeAsc()) {
            if (!Boolean.TRUE.equals(cred.getIsActive())) continue;
            if (cred.getCredentialKey1() == null || cred.getCredentialKey1().isBlank()) continue;
            if (!CHANNEL_DISPLAY_NAMES.containsKey(cred.getChannelType().toUpperCase())) continue;
            results.put(cred.getChannelType(), syncDailyChannel(cred.getChannelType(), from, to));
        }
        return results;
    }

    public Map<String, Object> syncDailyChannel(String channelType, LocalDate from, LocalDate to) {
        Map<String, Object> result = new LinkedHashMap<>();
        ChannelApiCredential cred = credentialRepo.findByChannelType(channelType.toUpperCase())
                .orElseThrow(() -> new RuntimeException("등록된 인증정보 없음: " + channelType));
        long totalAmount = 0L;
        int totalOrders = 0;
        int daysOk = 0;
        List<String> errors = new ArrayList<>();
        try {
            String naverToken = null;
            if (channelType.toUpperCase().startsWith("SMARTSTORE")) {
                naverToken = getNaverAccessToken(cred.getCredentialKey1(), cred.getCredentialKey2());
                if (naverToken == null) throw new RuntimeException("스마트스토어 인증 실패 (Client ID/Secret 확인)");
            }
            for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
                try {
                    DailySales sales;
                    switch (channelType.toUpperCase()) {
                        case "SMARTSTORE", "SMARTSTORE_2" -> sales = fetchSmartStoreDaily(naverToken, day);
                        case "COUPANG" -> sales = fetchCoupangDaily(cred, day);
                        case "IMWEB" -> sales = fetchImwebDaily(cred, day);
                        case "ELEVENST" -> sales = fetchElevenStDaily(cred, day);
                        default -> throw new RuntimeException("일별 수집 미지원 채널: " + channelType);
                    }
                    upsertDailySales(channelType, day, sales);
                    totalAmount += sales.amount();
                    totalOrders += sales.orderCount();
                    daysOk++;
                } catch (Exception e) {
                    errors.add(day + ": " + e.getMessage());
                    log.warn("[DailySync] {} {} failed: {}", channelType, day, e.getMessage());
                }
            }
            for (YearMonth ym = YearMonth.from(from); !ym.isAfter(YearMonth.from(to)); ym = ym.plusMonths(1)) {
                refreshMonthlyPerformanceFromDaily(channelType, ym);
            }
            boolean success = errors.isEmpty() || daysOk > 0;
            String message = String.format("일별 수집 %d일 완료, 합계 %,d원 / 주문 %d건%s",
                    daysOk, totalAmount, totalOrders,
                    errors.isEmpty() ? "" : " (실패 " + errors.size() + "일: " + String.join("; ", errors.subList(0, Math.min(3, errors.size()))) + ")");
            cred.setLastSyncAt(LocalDateTime.now());
            cred.setLastSyncStatus(success ? "SUCCESS" : "FAILED");
            cred.setLastSyncMessage(message);
            credentialRepo.save(cred);
            result.put("success", success);
            result.put("message", message);
            result.put("salesAmount", totalAmount);
            result.put("orderCount", totalOrders);
            result.put("daysSynced", daysOk);
            result.put("errors", errors);
        } catch (Exception e) {
            log.error("[DailySync] {} error: {}", channelType, e.getMessage(), e);
            cred.setLastSyncAt(LocalDateTime.now());
            cred.setLastSyncStatus("ERROR");
            cred.setLastSyncMessage(e.getMessage());
            credentialRepo.save(cred);
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }

    // ── 스마트스토어: 결제일 기준 일별 매출 (변경상태 PAYED 조회 → 상세 금액 조회) ──
    private DailySales fetchSmartStoreDaily(String accessToken, LocalDate day) throws Exception {
        List<String> productOrderIds = new ArrayList<>();
        String lastChangedFrom = URLEncoder.encode(
                day.atStartOfDay().atOffset(ZoneOffset.ofHours(9)).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME), StandardCharsets.UTF_8);
        String lastChangedTo = URLEncoder.encode(
                day.atTime(23, 59, 59).atOffset(ZoneOffset.ofHours(9)).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME), StandardCharsets.UTF_8);
        Long moreSequence = null;
        String moreFrom = null;
        for (int page = 0; page < 30; page++) {
            StringBuilder url = new StringBuilder("https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/last-changed-statuses")
                    .append("?lastChangedFrom=").append(moreFrom != null ? URLEncoder.encode(moreFrom, StandardCharsets.UTF_8) : lastChangedFrom)
                    .append("&lastChangedTo=").append(lastChangedTo)
                    .append("&lastChangedType=PAYED");
            if (moreSequence != null) url.append("&moreSequence=").append(moreSequence);
            HttpRequest request = HttpRequest.newBuilder().uri(URI.create(url.toString()))
                    .header("Authorization", "Bearer " + accessToken).GET().build();
            HttpResponse<String> response = sendNaver(request);
            if (response.statusCode() != 200) {
                throw new RuntimeException("스마트스토어 주문조회 HTTP " + response.statusCode() + ": " + truncate(response.body(), 200));
            }
            JsonNode data = objectMapper.readTree(response.body()).path("data");
            JsonNode statuses = data.path("lastChangeStatuses");
            if (statuses.isArray()) {
                for (JsonNode s : statuses) {
                    String id = s.path("productOrderId").asText("");
                    if (!id.isBlank()) productOrderIds.add(id);
                }
            }
            JsonNode more = data.path("more");
            if (more.isMissingNode() || more.isNull()) break;
            moreSequence = more.path("moreSequence").isMissingNode() ? null : more.path("moreSequence").asLong();
            moreFrom = more.path("moreFrom").asText(null);
            if (moreFrom == null) break;
        }
        long total = 0L;
        int count = 0;
        for (int i = 0; i < productOrderIds.size(); i += 300) {
            List<String> chunk = productOrderIds.subList(i, Math.min(i + 300, productOrderIds.size()));
            String body = objectMapper.writeValueAsString(Map.of("productOrderIds", chunk));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/query"))
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            HttpResponse<String> response = sendNaver(request);
            if (response.statusCode() != 200) {
                throw new RuntimeException("스마트스토어 주문상세 HTTP " + response.statusCode() + ": " + truncate(response.body(), 200));
            }
            JsonNode data = objectMapper.readTree(response.body()).path("data");
            if (data.isArray()) {
                for (JsonNode n : data) {
                    JsonNode po = n.path("productOrder");
                    long amt = po.path("totalPaymentAmount").asLong(0);
                    if (amt == 0) amt = n.path("order").path("generalPaymentAmount").asLong(0);
                    total += amt;
                    count++;
                }
            }
        }
        return new DailySales(total, count);
    }

    // ── 쿠팡: 주문 생성일 기준 일별 매출 (상태별 발주서 조회 합산, nextToken 페이지네이션) ──
    private DailySales fetchCoupangDaily(ChannelApiCredential cred, LocalDate day) throws Exception {
        String accessKey = cred.getCredentialKey1();
        String secretKey = cred.getCredentialKey2();
        String vendorId = cred.getCredentialKey3();
        if (vendorId == null || vendorId.isBlank()) {
            throw new RuntimeException("쿠팡 업체코드(Vendor ID, A로 시작)를 인증정보 3번 칸에 등록 필요");
        }
        String[] statuses = {"ACCEPT", "INSTRUCT", "DEPARTURE", "DELIVERING", "FINAL_DELIVERY"};
        long total = 0L;
        Set<String> orderIds = new HashSet<>();
        for (String status : statuses) {
            String nextToken = null;
            for (int page = 0; page < 30; page++) {
                String path = "/v2/providers/openapi/apis/api/v4/vendors/" + vendorId + "/ordersheets";
                StringBuilder query = new StringBuilder("?createdAtFrom=").append(day)
                        .append("&createdAtTo=").append(day)
                        .append("&status=").append(status)
                        .append("&maxPerPage=50");
                if (nextToken != null && !nextToken.isBlank()) query.append("&nextToken=").append(nextToken);
                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyMMdd'T'HHmmss'Z'");
                sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
                String datetime = sdf.format(new java.util.Date());
                String message = datetime + "GET" + path + query;
                String signature = hmacSha256Hex(message, secretKey);
                String authorization = String.format("CEA algorithm=HmacSHA256, access-key=%s, signed-date=%s, signature=%s",
                        accessKey, datetime, signature);
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create("https://api-gateway.coupang.com" + path + query))
                        .header("Authorization", authorization)
                        .header("Content-Type", "application/json").GET().build();
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 200) {
                    throw new RuntimeException("쿠팡 발주서조회(" + status + ") HTTP " + response.statusCode() + ": " + truncate(response.body(), 200));
                }
                JsonNode json = objectMapper.readTree(response.body());
                JsonNode data = json.path("data");
                if (data.isArray()) {
                    for (JsonNode sheet : data) {
                        long sheetAmount = 0L;
                        JsonNode items = sheet.path("orderItems");
                        if (items.isArray()) {
                            for (JsonNode item : items) {
                                long orderPrice = item.path("orderPrice").asLong(0);
                                if (orderPrice == 0) {
                                    orderPrice = item.path("salesPrice").asLong(0) * Math.max(1, item.path("shippingCount").asInt(1));
                                }
                                sheetAmount += orderPrice;
                            }
                        }
                        total += sheetAmount;
                        String orderId = sheet.path("orderId").asText("");
                        if (!orderId.isBlank()) orderIds.add(orderId);
                    }
                }
                nextToken = json.path("nextToken").asText(null);
                if (nextToken == null || nextToken.isBlank()) break;
            }
        }
        return new DailySales(total, orderIds.size());
    }

    // ── 아임웹: 기존 월별 로직의 일 단위 버전 ──
    private DailySales fetchImwebDaily(ChannelApiCredential cred, LocalDate day) throws Exception {
        String apiKey = cred.getCredentialKey1();
        String tokenBody = "{\"key\":\"" + apiKey + "\",\"secret\":\"" + (cred.getCredentialKey2() != null ? cred.getCredentialKey2() : "") + "\"}";
        HttpRequest tokenReq = HttpRequest.newBuilder().uri(URI.create("https://api.imweb.me/v2/auth"))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(tokenBody)).build();
        HttpResponse<String> tokenResp = httpClient.send(tokenReq, HttpResponse.BodyHandlers.ofString());
        if (tokenResp.statusCode() != 200) throw new RuntimeException("아임웹 인증 실패 HTTP " + tokenResp.statusCode());
        String accessToken = objectMapper.readTree(tokenResp.body()).path("data").path("access_token").asText();
        if (accessToken == null || accessToken.isBlank()) throw new RuntimeException("아임웹 access_token 없음");
        long startTs = day.atStartOfDay(KST).toEpochSecond();
        long endTs = day.atTime(23, 59, 59).atZone(KST).toEpochSecond();
        String ordersUrl = String.format("https://api.imweb.me/v2/shop/orders?order_status=pay_done&date_type=order_date&start_date=%d&end_date=%d", startTs, endTs);
        HttpRequest ordersReq = HttpRequest.newBuilder().uri(URI.create(ordersUrl)).header("access-token", accessToken).GET().build();
        HttpResponse<String> ordersResp = httpClient.send(ordersReq, HttpResponse.BodyHandlers.ofString());
        long total = 0L;
        int count = 0;
        if (ordersResp.statusCode() == 200) {
            JsonNode list = objectMapper.readTree(ordersResp.body()).path("data").path("list");
            if (list.isArray()) {
                for (JsonNode o : list) { total += o.path("order_price").asLong(0); count++; }
            }
        } else {
            throw new RuntimeException("아임웹 주문조회 HTTP " + ordersResp.statusCode());
        }
        return new DailySales(total, count);
    }

    // ── 11번가: 결제완료 주문조회 (오픈API, XML 응답) ──
    private DailySales fetchElevenStDaily(ChannelApiCredential cred, LocalDate day) throws Exception {
        String apiKey = cred.getCredentialKey1();
        DateTimeFormatter hourFmt = DateTimeFormatter.ofPattern("yyyyMMddHH");
        String start = day.atStartOfDay().format(hourFmt);
        String end = day.atTime(23, 0).format(hourFmt);
        String url = "https://openapi.11st.co.kr/rest/ordservices/complete/" + start + "/" + end;
        HttpRequest request = HttpRequest.newBuilder().uri(URI.create(url))
                .header("openapikey", apiKey)
                .header("Content-Type", "text/xml").GET().build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new RuntimeException("11번가 주문조회 HTTP " + response.statusCode() + ": " + truncate(response.body(), 200));
        }
        String body = response.body();
        if (body.contains("<ErrorMessage>") || body.contains("<message>") && body.contains("ERROR")) {
            throw new RuntimeException("11번가 API 오류: " + truncate(body.replaceAll("<[^>]+>", " ").trim(), 200));
        }
        javax.xml.parsers.DocumentBuilderFactory dbf = javax.xml.parsers.DocumentBuilderFactory.newInstance();
        dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        dbf.setNamespaceAware(true);
        org.w3c.dom.Document doc = dbf.newDocumentBuilder()
                .parse(new java.io.ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
        org.w3c.dom.NodeList orders = doc.getElementsByTagNameNS("*", "order");
        if (orders.getLength() == 0) orders = doc.getElementsByTagName("order");
        long total = 0L;
        int count = 0;
        for (int i = 0; i < orders.getLength(); i++) {
            org.w3c.dom.Element order = (org.w3c.dom.Element) orders.item(i);
            long amt = readXmlLong(order, "ordAmt");
            if (amt == 0) amt = readXmlLong(order, "ordPayAmt");
            if (amt == 0) amt = readXmlLong(order, "selPrc") * Math.max(1, (int) readXmlLong(order, "ordQty"));
            total += amt;
            count++;
        }
        return new DailySales(total, count);
    }

    private long readXmlLong(org.w3c.dom.Element parent, String tagName) {
        org.w3c.dom.NodeList nodes = parent.getElementsByTagNameNS("*", tagName);
        if (nodes.getLength() == 0) nodes = parent.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) return 0L;
        String text = nodes.item(0).getTextContent();
        if (text == null || text.isBlank()) return 0L;
        try {
            return new java.math.BigDecimal(text.trim()).longValue();
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private SyncResult syncElevenStMonthly(ChannelApiCredential cred, String targetMonth) throws Exception {
        YearMonth ym = YearMonth.parse(targetMonth);
        LocalDate from = ym.atDay(1);
        LocalDate to = ym.atEndOfMonth().isAfter(LocalDate.now(KST)) ? LocalDate.now(KST) : ym.atEndOfMonth();
        long total = 0L;
        int count = 0;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            DailySales sales = fetchElevenStDaily(cred, day);
            upsertDailySales("ELEVENST", day, sales);
            total += sales.amount();
            count += sales.orderCount();
        }
        saveOrUpdateChannelPerformance("11번가", targetMonth, total, count, "ELEVENST");
        return new SyncResult(true, String.format("11번가 sync OK: %d orders, %d won", count, total), total, count);
    }

    @Transactional
    protected void upsertDailySales(String channelType, LocalDate day, DailySales sales) {
        String channelName = CHANNEL_DISPLAY_NAMES.getOrDefault(channelType.toUpperCase(), channelType);
        jdbcTemplate.update(
                "DELETE FROM field_sales_entry WHERE company_id = ? AND channel_name = ? AND entry_date = ? AND created_by = ?",
                DEFAULT_COMPANY_ID, channelName, java.sql.Date.valueOf(day), SYNC_CREATED_BY);
        if (sales.amount() > 0 || sales.orderCount() > 0) {
            jdbcTemplate.update(
                    "INSERT INTO field_sales_entry (company_id, channel_name, entry_date, quantity, sales_amount, memo, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    DEFAULT_COMPANY_ID, channelName, java.sql.Date.valueOf(day), sales.orderCount(), sales.amount(),
                    "채널 API 자동수집 (주문 " + sales.orderCount() + "건)", SYNC_CREATED_BY);
        }
    }

    private void refreshMonthlyPerformanceFromDaily(String channelType, YearMonth ym) {
        String channelName = CHANNEL_DISPLAY_NAMES.getOrDefault(channelType.toUpperCase(), channelType);
        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT COALESCE(SUM(sales_amount), 0) AS total, COALESCE(SUM(quantity), 0) AS orders " +
                        "FROM field_sales_entry WHERE company_id = ? AND channel_name = ? AND created_by = ? AND entry_date BETWEEN ? AND ?",
                DEFAULT_COMPANY_ID, channelName, SYNC_CREATED_BY,
                java.sql.Date.valueOf(ym.atDay(1)), java.sql.Date.valueOf(ym.atEndOfMonth()));
        long total = ((Number) row.getOrDefault("total", 0)).longValue();
        int orders = ((Number) row.getOrDefault("orders", 0)).intValue();
        if (total > 0 || orders > 0) {
            saveOrUpdateChannelPerformance(channelName, ym.toString(), total, orders, channelType.toUpperCase());
        }
    }

    private String truncate(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max) + "…";
    }

    private record DailySales(long amount, int orderCount) {}

    private record SyncResult(boolean success, String message, long salesAmount, int orderCount) {}
}
