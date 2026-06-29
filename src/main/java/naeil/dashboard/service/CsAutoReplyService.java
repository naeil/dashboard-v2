package naeil.dashboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.entity.ChannelApiCredential;
import naeil.dashboard.entity.CsAutoReply;
import naeil.dashboard.entity.CsInquiry;
import naeil.dashboard.repository.ChannelApiCredentialRepository;
import naeil.dashboard.repository.CsAutoReplyRepository;
import naeil.dashboard.repository.CsInquiryRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * CS 자동답변 서비스
   *
   * 데이터 흐름: 수집 → 분류 → 위험도 판정 → 답변 생성 → 발송/대기 → 로그
   *
   * 위험도 게이트:
   *  AUTO  : 별점 4-5점, 단순감사/긍정, confidence >= threshold
   *  QUEUE : 별점 1-3점, 환불/교환/반품/취소/법적/알레르기 키워드, 욕설, 반복문의
   *
   * 킬 스위치: autoSendEnabled = false 이면 모든 발송 차단
   */
@Slf4j
  @Service
  @RequiredArgsConstructor
  public class CsAutoReplyService {

    private static final String PLAYAUTO_BASE = "https://openapi.playauto.io/api";
        private static final String CHANNEL_TYPE_PLAYAUTO = "PLAYAUTO";
        private static final double CONFIDENCE_THRESHOLD = 0.75;
        private static final String PERSONA_VERSION = "v1.0";
        private static final String RULE_VERSION = "v1.0";

    // ===== 킬 스위치 & 드라이런 =====
    private final AtomicBoolean autoSendEnabled = new AtomicBoolean(false); // 기본값: 킬 스위치 ON (발송 차단)
    private final AtomicBoolean dryRunMode = new AtomicBoolean(true);       // 기본값: 드라이런 모드

    private final CsInquiryRepository inquiryRepo;
        private final CsAutoReplyRepository replyRepo;
        private final ChannelApiCredentialRepository credentialRepo;
        private final ObjectMapper objectMapper;

    @Value("${app.ai.openai-api-key:}")
        private String openAiApiKey;

    // ===== 위험 키워드 (QUEUE 판정) =====
    private static final List<String> RISK_KEYWORDS = Arrays.asList(
              "환불", "반품", "교환", "취소", "보상", "배상", "법적", "신고", "소비자원",
              "알레르기", "부작용", "상함", "곰팡이", "불량", "파손", "유통기한",
              "욕", "ㅅㅂ", "ㅄ", "개새", "병신", "미친", "최악", "쓰레기", "사기",
              "재차", "또", "몇 번째", "계속", "반복"
          );

    // ===== 브랜드 인사말 (명세서 verbatim) =====
    private static final Map<String, String> BRAND_GREETING = Map.of(
              "하이프리", "고객님의 건강을 챙겨주셔서 감사합니다.안녕하세요, 하이프리입니다 :)",
              "국민한상", "고객님의 소중한 식사를 챙겨주셔서 감사합니다. 안녕하세요, 국민한상입니다 :)"
          );

    // ===== 카테고리별 auto 토글 설정 =====
    private final Map<String, Boolean> categoryAutoEnabled = new LinkedHashMap<>(Map.of(
              "단순감사", true,
              "상품문의", true,
              "배송문의", false,
              "교환반품", false,
              "불만클레임", false,
              "기타", false
          ));

    // ============================================================
    // PUBLIC API
    // ============================================================

    /** 킬 스위치 상태 조회/변경 */
    public Map<String, Object> getStatus() {
              Map<String, Object> status = new LinkedHashMap<>();
              status.put("autoSendEnabled", autoSendEnabled.get());
              status.put("dryRunMode", dryRunMode.get());
              status.put("confidenceThreshold", CONFIDENCE_THRESHOLD);
              status.put("categoryAutoEnabled", categoryAutoEnabled);
              status.put("personaVersion", PERSONA_VERSION);
              status.put("ruleVersion", RULE_VERSION);
              return status;
    }

    public void setAutoSendEnabled(boolean enabled) {
              autoSendEnabled.set(enabled);
              log.info("[CsAutoReply] autoSendEnabled set to: {}", enabled);
    }

    public void setDryRunMode(boolean dryRun) {
              dryRunMode.set(dryRun);
              log.info("[CsAutoReply] dryRunMode set to: {}", dryRun);
    }

    public void setCategoryAutoEnabled(String category, boolean enabled) {
              categoryAutoEnabled.put(category, enabled);
              log.info("[CsAutoReply] category '{}' autoEnabled set to: {}", category, enabled);
    }

    /** 문의 수집 (플레이오토 -> DB) */
    @Transactional
        public Map<String, Object> collectInquiries() {
                  ChannelApiCredential cred = getPlayAutoCredential();
                  if (cred == null) return Map.of("success", false, "message", "PlayAuto credentials not configured");

            try {
                          String token = getPlayAutoToken(cred);
                          if (token == null) return Map.of("success", false, "message", "PlayAuto auth failed");

                      List<Map<String, Object>> rawInquiries = fetchInquiriesFromPlayAuto(cred, token);
                          int saved = 0;
                          int skipped = 0;

                      for (Map<String, Object> raw : rawInquiries) {
                                        String inqUniq = str(raw, "inq_uniq");
                                        if (inqUniq == null || inquiryRepo.existsByInqUniq(inqUniq)) { skipped++; continue; }

                              CsInquiry inquiry = buildInquiry(raw);
                                        inquiryRepo.save(inquiry);

                              // 즉시 답변 생성 처리
                              processInquiry(inquiry, cred, token);
                                        saved++;
                      }

                      return Map.of("success", true, "saved", saved, "skipped", skipped, "total", rawInquiries.size());
            } catch (Exception e) {
                          log.error("[CsAutoReply] collectInquiries error: {}", e.getMessage(), e);
                          return Map.of("success", false, "message", e.getMessage());
            }
        }

    /** 대기열 문의 수동 승인 발송 */
    @Transactional
        public Map<String, Object> approveAndSend(Long replyId, String approvedBy) {
                  CsAutoReply reply = replyRepo.findById(replyId)
                                .orElseThrow(() -> new RuntimeException("Reply not found: " + replyId));

            if (!"PENDING".equals(reply.getStatus())) {
                          return Map.of("success", false, "message", "Only PENDING replies can be approved");
            }

            // 발송 전 최종 검증
            String validation = validateReplyContent(reply.getReplyContent());
                  if (validation != null) {
                                return Map.of("success", false, "message", "Validation failed: " + validation);
                  }

            if (dryRunMode.get()) {
                          reply.setStatus("AUTO_SENT");
                          reply.setSentAt(LocalDateTime.now());
                          reply.setApprovedBy(approvedBy);
                          reply.setApprovedAt(LocalDateTime.now());
                          reply.setPlayautoResult("{\"dryRun\": true}");
                          replyRepo.save(reply);
                          return Map.of("success", true, "message", "[DRY-RUN] Reply approved and logged (not actually sent)");
            }

            ChannelApiCredential cred = getPlayAutoCredential();
                  if (cred == null) return Map.of("success", false, "message", "PlayAuto credentials not configured");

            try {
                          String token = getPlayAutoToken(cred);
                          Map<String, Object> result = sendReplyToPlayAuto(cred, token, reply.getInqUniq(), reply.getReplyTitle(), reply.getReplyContent());
                          boolean success = Boolean.TRUE.equals(result.get("success"));

                      reply.setStatus(success ? "MANUALLY_SENT" : "PENDING");
                          reply.setApprovedBy(approvedBy);
                          reply.setApprovedAt(LocalDateTime.now());
                          if (success) reply.setSentAt(LocalDateTime.now());
                          reply.setPlayautoResult(objectMapper.writeValueAsString(result));
                          replyRepo.save(reply);

                      return result;
            } catch (Exception e) {
                          return Map.of("success", false, "message", e.getMessage());
            }
        }

    /** 대기열 조회 */
    public List<Map<String, Object>> getPendingQueue() {
              return replyRepo.findByStatusOrderByCreatedAtDesc("PENDING")
                            .stream().map(this::replyToMap).toList();
    }

    /** 전체 로그 조회 */
    public List<Map<String, Object>> getReplyLog() {
              return replyRepo.findTop100ByOrderByCreatedAtDesc()
                            .stream().map(this::replyToMap).toList();
    }

    /** 통계 */
    public Map<String, Object> getStats() {
              return Map.of(
                            "totalInquiries", inquiryRepo.count(),
                            "pendingQueue", replyRepo.countByStatus("PENDING"),
                            "autoSent", replyRepo.countByStatus("AUTO_SENT"),
                            "manuallySent", replyRepo.countByStatus("MANUALLY_SENT"),
                            "rejected", replyRepo.countByStatus("REJECTED"),
                            "autoSendEnabled", autoSendEnabled.get(),
                            "dryRunMode", dryRunMode.get()
                        );
    }

    // ============================================================
    // PRIVATE - CORE PIPELINE
    // ============================================================

    private void processInquiry(CsInquiry inquiry, ChannelApiCredential cred, String token) {
              // 이미 처리된 문의 건너뜀 (idempotency)
            if (replyRepo.existsByInqUniq(inquiry.getInqUniq())) {
                          log.debug("[CsAutoReply] Already processed: {}", inquiry.getInqUniq());
                          return;
            }

            // 1. 분류
            String category = classify(inquiry);
              inquiry.setCategory(category);

            // 2. 위험도 판정
            String riskLevel = assessRisk(inquiry, category);
              inquiry.setRiskLevel(riskLevel);
              inquiryRepo.save(inquiry);

            // 3. 답변 생성
            String[] reply = generateReply(inquiry, category);
              String replyTitle = reply[0];
              String replyContent = reply[1];
              double confidence = calculateConfidence(inquiry, category);

            // 4. 발송 전 최종 검증
            String validationError = validateReplyContent(replyContent);
              if (validationError != null) {
                            riskLevel = "QUEUE"; // 검증 실패 시 대기로 전환
                  log.warn("[CsAutoReply] Validation failed for {}: {}", inquiry.getInqUniq(), validationError);
              }

            // 5. 상태 결정
            boolean categoryEnabled = categoryAutoEnabled.getOrDefault(category, false);
              boolean shouldAutoSend = "AUTO".equals(riskLevel) && categoryEnabled &&
                            confidence >= CONFIDENCE_THRESHOLD && autoSendEnabled.get() && validationError == null;

            String status = shouldAutoSend ? "AUTO_SENT" : "PENDING";

            // 6. DB 저장
            CsAutoReply autoReply = CsAutoReply.builder()
                          .inqUniq(inquiry.getInqUniq())
                          .inquiryId(inquiry.getId())
                          .channel(inquiry.getChannel())
                          .brand(inquiry.getBrand())
                          .category(category)
                          .riskLevel(riskLevel)
                          .confidence(confidence)
                          .replyTitle(replyTitle)
                          .replyContent(replyContent)
                          .status("PENDING") // 먼저 PENDING으로 저장
                          .dryRun(dryRunMode.get())
                          .personaVersion(PERSONA_VERSION)
                          .ruleVersion(RULE_VERSION)
                          .build();
              replyRepo.save(autoReply);

            // 7. 자동발송 실행
            if (shouldAutoSend) {
                          if (dryRunMode.get()) {
                                            autoReply.setStatus("AUTO_SENT");
                                            autoReply.setSentAt(LocalDateTime.now());
                                            autoReply.setPlayautoResult("{\"dryRun\": true, \"message\": \"Dry-run mode: not actually sent\"}");
                                            replyRepo.save(autoReply);
                                            log.info("[CsAutoReply][DRY-RUN] Would auto-send reply for: {}", inquiry.getInqUniq());
                          } else {
                                            try {
                                                                  Map<String, Object> sendResult = sendReplyToPlayAuto(cred, token, inquiry.getInqUniq(), replyTitle, replyContent);
                                                                  boolean sent = Boolean.TRUE.equals(sendResult.get("success"));
                                                                  autoReply.setStatus(sent ? "AUTO_SENT" : "PENDING");
                                                                  if (sent) autoReply.setSentAt(LocalDateTime.now());
                                                                  autoReply.setPlayautoResult(objectMapper.valueToTree(sendResult).toString());
                                                                  replyRepo.save(autoReply);
                                                                  log.info("[CsAutoReply] Auto-sent reply for {} : {}", inquiry.getInqUniq(), sent);
                                            } catch (Exception e) {
                                                                  log.error("[CsAutoReply] Failed to auto-send for {}: {}", inquiry.getInqUniq(), e.getMessage());
                                            }
                          }
            }
    }

    // ===== 분류 =====
    private String classify(CsInquiry inquiry) {
              String content = inquiry.getInqContent() != null ? inquiry.getInqContent().toLowerCase() : "";
              String type = inquiry.getInqType() != null ? inquiry.getInqType() : "";
              Integer rating = inquiry.getRating();

            if ("상품평".equals(type) && rating != null && rating >= 4) return "단순감사";
              if (content.contains("환불") || content.contains("반품") || content.contains("교환") || content.contains("취소")) return "교환반품";
              if (content.contains("배송") || content.contains("운송장") || content.contains("택배") || content.contains("도착")) return "배송문의";
              if (content.contains("불량") || content.contains("파손") || content.contains("상함") || content.contains("실망") || content.contains("최악")) return "불만클레임";
              if (content.contains("성분") || content.contains("섭취") || content.contains("보관") || content.contains("효과") || content.contains("추천")) return "상품문의";
              if (rating != null && rating >= 4) return "단순감사";
              return "기타";
    }

    // ===== 위험도 판정 =====
    private String assessRisk(CsInquiry inquiry, String category) {
              String content = inquiry.getInqContent() != null ? inquiry.getInqContent().toLowerCase() : "";
              Integer rating = inquiry.getRating();

            // 별점 1-3점
            if (rating != null && rating <= 3) return "QUEUE";
              // 위험 키워드
            if (RISK_KEYWORDS.stream().anyMatch(content::contains)) return "QUEUE";
              // 카테고리 기반
            if (Set.of("교환반품", "불만클레임").contains(category)) return "QUEUE";

            return "AUTO";
    }

    // ===== 신뢰도 계산 =====
    private double calculateConfidence(CsInquiry inquiry, String category) {
              double base = 0.5;
              if ("단순감사".equals(category)) base = 0.95;
              else if ("상품문의".equals(category)) base = 0.80;
              else if ("배송문의".equals(category)) base = 0.70;
              else if ("교환반품".equals(category)) base = 0.30;
              else if ("불만클레임".equals(category)) base = 0.20;

            Integer rating = inquiry.getRating();
              if (rating != null) {
                            if (rating >= 4) base += 0.10;
                            else if (rating <= 2) base -= 0.20;
              }
              return Math.min(1.0, Math.max(0.0, base));
    }

    // ===== 답변 생성 =====
    private String[] generateReply(CsInquiry inquiry, String category) {
              String brand = inquiry.getBrand() != null ? inquiry.getBrand() : "";
              String productName = inquiry.getShopSaleName() != null ? inquiry.getShopSaleName() : "제품";
              String customerName = inquiry.getInqName() != null ? inquiry.getInqName() : "고객님";
              String greeting = BRAND_GREETING.getOrDefault(brand, "안녕하세요 :)");

            // 답변 다양화: 랜덤 변형 선택
            int variant = (int) (Math.random() * 3);

            String title;
              String content;

            switch (category) {
              case "단순감사" -> {
                                title = productName + " 리뷰 감사드립니다";
                                content = switch (variant) {
                                  case 0 -> greeting + "\n\n" + customerName + "께서 남겨주신 소중한 리뷰 진심으로 감사드립니다 :)\n" +
                                                            productName + "이 마음에 드셨다니 저희도 정말 기쁩니다.\n앞으로도 최고의 품질로 보답하겠습니다. 감사합니다!";
                                  case 1 -> greeting + "\n\n와~ " + customerName + ", 이런 따뜻한 리뷰 주셔서 저희 팀 모두 너무 행복해요 :)\n" +
                                                            productName + " 앞으로도 꾸준히 함께해 주세요!";
                                                      default -> greeting + "\n\n" + customerName + "의 소중한 평가 감사합니다!\n" +
                                                                                productName + "을 사랑해주셔서 저희가 더 열심히 할 수 있어요. 건강하게 즐겨주세요 :)";
                                };
              }
              case "상품문의" -> {
                                title = productName + " 문의 답변드립니다";
                                content = greeting + "\n\n" + customerName + ", 문의 주셔서 감사합니다!\n" +
                                                      productName + "에 대해 궁금하신 점이 있으시다면 고객센터로 연락해 주시면 더 자세히 안내해 드리겠습니다.\n항상 최고의 제품으로 보답하겠습니다 :)";
              }
              case "배송문의" -> {
                                title = "배송 관련 안내드립니다";
                                content = greeting + "\n\n" + customerName + ", 배송 문의 주셔서 감사합니다.\n" +
                                                      "배송 현황은 고객센터(또는 배송 조회 서비스)에서 확인하실 수 있습니다.\n불편을 드려 죄송합니다. 빠른 시일 내 해결될 수 있도록 최선을 다하겠습니다 :)";
              }
                            default -> {
                                              title = customerName + " 문의 답변드립니다";
                                              content = greeting + "\n\n" + customerName + ", 문의 주셔서 감사합니다.\n" +
                                                                    "내용 확인 후 빠르게 도움드리겠습니다. 추가 문의는 고객센터를 이용해 주세요 :)";
                            }
            }

            return new String[]{title, content};
    }

    // ===== 발송 전 최종 검증 =====
    private String validateReplyContent(String content) {
              if (content == null || content.isBlank()) return "빈 답변입니다";
              if (content.length() < 10) return "답변이 너무 짧습니다";
              // 금지어 체크 (확정 불가 약속)
            List<String> forbidden = Arrays.asList("무조건 환불", "100% 보장", "법적 책임", "꼭 보상");
              for (String f : forbidden) {
                            if (content.contains(f)) return "금지 표현 포함: " + f;
              }
              return null; // 검증 통과
    }

    // ============================================================
    // PRIVATE - PLAYAUTO API
    // ============================================================

    private ChannelApiCredential getPlayAutoCredential() {
              return credentialRepo.findByChannelType(CHANNEL_TYPE_PLAYAUTO).orElse(null);
    }

    private String getPlayAutoToken(ChannelApiCredential cred) {
              try {
                            RestTemplate rt = new RestTemplate();
                            HttpHeaders headers = new HttpHeaders();
                            headers.setContentType(MediaType.APPLICATION_JSON);
                            headers.set("x-api-key", cred.getCredentialKey1()); // API Key

                  Map<String, String> body = new HashMap<>();
                            // key2 = authentication_key (솔루션 인증키)
                  body.put("authentication_key", cred.getCredentialKey2());

                  HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);
                            ResponseEntity<JsonNode> resp = rt.postForEntity(PLAYAUTO_BASE + "/auth", entity, JsonNode.class);

                  if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                                    JsonNode arr = resp.getBody();
                                    if (arr.isArray() && arr.size() > 0) return arr.get(0).path("token").asText();
                  }
              } catch (Exception e) {
                            log.error("[CsAutoReply] PlayAuto auth error: {}", e.getMessage());
              }
              return null;
    }

    private List<Map<String, Object>> fetchInquiriesFromPlayAuto(ChannelApiCredential cred, String token) {
              try {
                            RestTemplate rt = new RestTemplate();
                            HttpHeaders headers = new HttpHeaders();
                            headers.setContentType(MediaType.APPLICATION_JSON);
                            headers.set("x-api-key", cred.getCredentialKey1());
                            headers.set("Authorization", "Token " + token);

                  String today = LocalDate.now().toString();
                            String weekAgo = LocalDate.now().minusDays(7).toString();

                  Map<String, Object> body = new LinkedHashMap<>();
                            body.put("date_type", "wdate");
                            body.put("sdate", weekAgo);
                            body.put("edate", today);
                            body.put("inq_status", "신규문의");

                  HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
                            ResponseEntity<JsonNode> resp = rt.postForEntity(PLAYAUTO_BASE + "/inquirys", entity, JsonNode.class);

                  List<Map<String, Object>> result = new ArrayList<>();
                            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                                              JsonNode results = resp.getBody().path("results");
                                              if (results.isArray()) {
                                                                    for (JsonNode node : results) {
                                                                                              Map<String, Object> m = objectMapper.convertValue(node, Map.class);
                                                                                              result.add(m);
                                                                    }
                                              }
                            }
                            return result;
              } catch (Exception e) {
                            log.error("[CsAutoReply] fetchInquiries error: {}", e.getMessage());
                            return Collections.emptyList();
              }
    }

    private Map<String, Object> sendReplyToPlayAuto(ChannelApiCredential cred, String token, String inqUniq, String title, String content) {
              try {
                            RestTemplate rt = new RestTemplate();
                            HttpHeaders headers = new HttpHeaders();
                            headers.setContentType(MediaType.APPLICATION_JSON);
                            headers.set("x-api-key", cred.getCredentialKey1());
                            headers.set("Authorization", "Token " + token);

                  Map<String, Object> inqPayload = new LinkedHashMap<>();
                            inqPayload.put("inq_uniq", inqUniq);
                            inqPayload.put("title", title);
                            inqPayload.put("content", content.replace("\n", "\\n"));

                  Map<String, Object> body = Map.of("inquirys", List.of(inqPayload));
                            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

                  ResponseEntity<JsonNode> resp = rt.exchange(
                                    PLAYAUTO_BASE + "/inquiry/answer",
                                    HttpMethod.PUT,
                                    entity,
                                    JsonNode.class
                                );

                  if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                                    JsonNode results = resp.getBody().path("results");
                                    if (results.isArray() && results.size() > 0) {
                                                          String result = results.get(0).path("result").asText();
                                                          boolean success = "성공".equals(result);
                                                          return Map.of("success", success, "result", result,
                                                                                                "message", results.get(0).path("message").asText(""));
                                    }
                  }
                            return Map.of("success", false, "message", "Unexpected response from PlayAuto");
              } catch (Exception e) {
                            log.error("[CsAutoReply] sendReply error for {}: {}", inqUniq, e.getMessage());
                            return Map.of("success", false, "message", e.getMessage());
              }
    }

    // ============================================================
    // PRIVATE - HELPERS
    // ============================================================

    private CsInquiry buildInquiry(Map<String, Object> raw) {
              String shopId = str(raw, "shop_id");
              String brand = inferBrand(shopId, str(raw, "shop_sale_name"));

            String inqTimeStr = str(raw, "inq_time");
              LocalDateTime inqTime = null;
              if (inqTimeStr != null) {
                            try { inqTime = LocalDateTime.parse(inqTimeStr, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")); }
                            catch (Exception ignored) {}
              }

            return CsInquiry.builder()
                          .inqUniq(str(raw, "inq_uniq"))
                          .channel(str(raw, "shop_name"))
                          .brand(brand)
                          .inqType(str(raw, "inq_type"))
                          .shopSaleNo(str(raw, "shop_sale_no"))
                          .shopSaleName(str(raw, "shop_sale_name"))
                          .shopOrdNo(str(raw, "shop_ord_no"))
                          .inqId(str(raw, "inq_id"))
                          .inqName(str(raw, "inq_name"))
                          .inqTitle(str(raw, "inq_title"))
                          .inqContent(str(raw, "inq_content"))
                          .inqTime(inqTime)
                          .enSendCs(str(raw, "en_sendCs_yn"))
                          .status("NEW")
                          .build();
    }

    private String inferBrand(String shopId, String productName) {
              if (shopId != null && shopId.contains("loya")) return "하이프리";
              if (productName != null) {
                            if (productName.contains("하이프리") || productName.contains("hypuri")) return "하이프리";
                            if (productName.contains("국민한상")) return "국민한상";
              }
              return "하이프리"; // 기본값
    }

    private String str(Map<String, Object> map, String key) {
              Object v = map.get(key);
              return v != null ? v.toString() : null;
    }

    private Map<String, Object> replyToMap(CsAutoReply r) {
              Map<String, Object> m = new LinkedHashMap<>();
              m.put("id", r.getId());
              m.put("inqUniq", r.getInqUniq());
              m.put("channel", r.getChannel());
              m.put("brand", r.getBrand());
              m.put("category", r.getCategory());
              m.put("riskLevel", r.getRiskLevel());
              m.put("confidence", r.getConfidence());
              m.put("replyTitle", r.getReplyTitle());
              m.put("replyContent", r.getReplyContent());
              m.put("status", r.getStatus());
              m.put("dryRun", r.getDryRun());
              m.put("sentAt", r.getSentAt());
              m.put("approvedBy", r.getApprovedBy());
              m.put("createdAt", r.getCreatedAt());
              return m;
    }
  }
