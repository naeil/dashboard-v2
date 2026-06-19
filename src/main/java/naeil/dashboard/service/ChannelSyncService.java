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
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChannelSyncService {

private final ChannelApiCredentialRepository credentialRepo;
private final OnlineChannelPerformanceRepository onlineRepo;
private final ObjectMapper objectMapper = new ObjectMapper();
private final HttpClient httpClient = HttpClient.newHttpClient();

@Scheduled(cron = "0 0 3 * * *", zone = "Asia/Seoul")
public void scheduledDailySync() {
log.info("[ChannelSync] Starting scheduled daily sync...");
syncAllChannels(YearMonth.now().toString());
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
case "SMARTSTORE": syncResult = syncSmartStore(cred, targetMonth); break;
case "COUPANG": syncResult = syncCoupang(cred, targetMonth); break;
case "IMWEB": syncResult = syncImweb(cred, targetMonth); break;
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

String tokenUrl = "https://api.commerce.naver.com/external/v1/oauth2/token";
long timestamp = System.currentTimeMillis();
String sign = generateNaverSign(clientId, clientSecret, timestamp);

String tokenBody = "client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
+ "&timestamp=" + timestamp
+ "&client_secret_sign=" + URLEncoder.encode(sign, StandardCharsets.UTF_8)
+ "&grant_type=client_credentials"
+ "&type=SELF";

log.info("[Naver Token Request] client_id(앞6자리)={} | timestamp={} | sign(앞10자리)={}",
clientId.substring(0, Math.min(6, clientId.length())), timestamp,
sign.substring(0, Math.min(10, sign.length())));

HttpRequest tokenRequest = HttpRequest.newBuilder()
.uri(URI.create(tokenUrl))
.header("Content-Type", "application/x-www-form-urlencoded")
.POST(HttpRequest.BodyPublishers.ofString(tokenBody))
.build();

HttpResponse<String> tokenResponse = httpClient.send(tokenRequest, HttpResponse.BodyHandlers.ofString());

log.info("[Naver API Response] HTTP Status: {} | Response Body: {}",
tokenResponse.statusCode(), tokenResponse.body());

if (tokenResponse.statusCode() != 200) {
log.error("[Naver API Error] HTTP Status: {} | Response Body: {}",
tokenResponse.statusCode(), tokenResponse.body());
return new SyncResult(false,
"SmartStore auth failed: HTTP " + tokenResponse.statusCode() + " | " + tokenResponse.body(), 0, 0);
}

JsonNode tokenJson = objectMapper.readTree(tokenResponse.body());
String accessToken = tokenJson.path("access_token").asText();
if (accessToken == null || accessToken.isBlank()) {
return new SyncResult(false, "SmartStore: access_token not found | body: " + tokenResponse.body(), 0, 0);
}
log.info("[Naver Token] 발급 성공. expires_in={}s", tokenJson.path("expires_in").asInt());

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

HttpResponse<String> ordersResponse = httpClient.send(ordersRequest, HttpResponse.BodyHandlers.ofString());

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

saveOrUpdateChannelPerformance("스마트스토어", targetMonth, totalSales, orderCount, "SMARTSTORE");
return new SyncResult(true, String.format("SmartStore sync OK: %d orders, %d won", orderCount, totalSales), totalSales, orderCount);
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
if (key1 != null) cred.setCredentialKey1(key1); if (key2 != null) cred.setCredentialKey2(key2);
if (key3 != null) cred.setCredentialKey3(key3); if (key4 != null) cred.setCredentialKey4(key4);
if (isActive != null) cred.setIsActive(isActive);
return credentialRepo.save(cred);
}

// ── 네이버 전자서명: BCrypt(clientId_timestamp, clientSecret) → Base64(URL-safe) ──
private String generateNaverSign(String clientId, String clientSecret, long timestamp) {
String password = clientId + "_" + timestamp;
// BCrypt.hashpw: password를 clientSecret(salt)로 bcrypt 해싱
String hashed = BCrypt.hashpw(password, clientSecret);
// URL-safe Base64 인코딩 (네이버 공식 문서 기준)
return Base64.getUrlEncoder().encodeToString(hashed.getBytes(StandardCharsets.UTF_8));
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

private record SyncResult(boolean success, String message, long salesAmount, int orderCount) {}
}
