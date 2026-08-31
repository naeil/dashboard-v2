package naeil.dashboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.entity.AiReview;
import naeil.dashboard.entity.AiReviewAnalysis;
import naeil.dashboard.repository.AiReviewRepository;
import naeil.dashboard.repository.AiReviewAnalysisRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiReviewService {

    private final AiReviewRepository reviewRepository;
    private final AiReviewAnalysisRepository analysisRepository;
    private final ObjectMapper objectMapper;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Value("${app.ai.openai-api-key:}")
    private String openAiApiKey;

    private static final List<String> URGENT_KEYWORDS = Arrays.asList(
        "환불", "반품", "불량", "상함", "파손", "냄새", "곰팡이",
        "유통기한", "신고", "배탈", "부작용"
    );

    @Transactional
    public AiReview saveReviewIfNotExists(AiReview review) {
        if (reviewRepository.existsByChannelAndReviewId(review.getChannel(), review.getReviewId())) {
            return null;
        }
        return reviewRepository.save(review);
    }

    /** 분석 결과 계산만 (저장 없음) — 대량 업로드의 배치 INSERT 용 */
    public AiReviewAnalysis buildAnalysis(AiReview review) {
        String content = review.getReviewContent() != null ? review.getReviewContent() : "";
        String sentiment = analyzeSentiment(content, review.getRating());
        boolean isUrgent = checkUrgent(content);
        return AiReviewAnalysis.builder()
                .reviewId(review.getId())
                .sentiment(sentiment)
                .isUrgent(isUrgent)
                .urgentKeywords(String.join(",", findUrgentKeywords(content)))
                .keywords(String.join(",", extractKeywords(content, review.getBrand())))
                .replyDraft(generateReplyDraft(review, sentiment))
                .replyStatus(determineReplyStatus(review.getRating(), isUrgent))
                .analysisStatus("COMPLETED")
                .analyzedAt(LocalDateTime.now())
                .build();
    }

    @Transactional
    public AiReviewAnalysis analyzeReview(AiReview review) {
        try {
            String content = review.getReviewContent() != null ? review.getReviewContent() : "";
            String sentiment = analyzeSentiment(content, review.getRating());
            boolean isUrgent = checkUrgent(content);
            List<String> foundUrgentKeywords = findUrgentKeywords(content);
            List<String> keywords = extractKeywords(content, review.getBrand());

            String replyDraft = generateReplyDraft(review, sentiment);
            String replyStatus = determineReplyStatus(review.getRating(), isUrgent);

            AiReviewAnalysis analysis = AiReviewAnalysis.builder()
                .reviewId(review.getId())
                .sentiment(sentiment)
                .isUrgent(isUrgent)
                .urgentKeywords(String.join(",", foundUrgentKeywords))
                .keywords(String.join(",", keywords))
                .replyDraft(replyDraft)
                .replyStatus(replyStatus)
                .analysisStatus("COMPLETED")
                .analyzedAt(LocalDateTime.now())
                .build();

            return analysisRepository.save(analysis);
        } catch (Exception e) {
            log.error("Review analysis failed for review id: {}", review.getId(), e);
            return null;
        }
    }

    private String analyzeSentiment(String content, int rating) {
        if (rating >= 4) return "POSITIVE";
        if (rating == 3) return "NEUTRAL";
        return "NEGATIVE";
    }

    private boolean checkUrgent(String content) {
        if (content == null) return false;
        String lower = content.toLowerCase();
        return URGENT_KEYWORDS.stream().anyMatch(lower::contains);
    }

    private List<String> findUrgentKeywords(String content) {
        if (content == null) return Collections.emptyList();
        String lower = content.toLowerCase();
        return URGENT_KEYWORDS.stream().filter(lower::contains).collect(Collectors.toList());
    }

    private List<String> extractKeywords(String content, String brand) {
        List<String> keywords = new ArrayList<>();
        if (content == null) return keywords;
        Map<String, List<String>> brandKeywords = new HashMap<>();
        brandKeywords.put("하이프리", Arrays.asList("변비", "붓기", "장건강", "맛", "가격", "재구매"));
        brandKeywords.put("국민한상", Arrays.asList("배송", "품질", "양", "가격", "재구매"));
        List<String> targetKeywords = brandKeywords.getOrDefault(brand != null ? brand : "",
            Arrays.asList("맛", "가격", "배송", "재구매", "품질"));
        String lower = content.toLowerCase();
        targetKeywords.stream().filter(lower::contains).forEach(keywords::add);
        return keywords;
    }

    private String generateReplyDraft(AiReview review, String sentiment) {
        String brand = review.getBrand() != null ? review.getBrand() : "";
        String productName = review.getProductName() != null ? review.getProductName() : "제품";
        String customerName = review.getCustomerName() != null ? review.getCustomerName() : "고객님";
        if (brand.contains("국민한상")) {
            if ("POSITIVE".equals(sentiment)) {
                return String.format("안녕하세요, %s. 국민한상 %s에 좋은 평가 주셔서 진심으로 감사드립니다. 고객님의 소중한 의견이 저희에게 큰 힘이 됩니다. 앞으로도 최고의 품질로 보답하겠습니다.", customerName, productName);
            } else {
                return String.format("안녕하세요, %s. 국민한상입니다. 불편하신 점을 말씀해 주셔서 감사합니다. 더 나은 서비스를 위해 신중히 검토하겠습니다. 이메일 또는 고객센터로 연락 주시면 성심껏 도와드리겠습니다.", customerName);
            }
        } else {
            if ("POSITIVE".equals(sentiment)) {
                return String.format("안녕하세요, %s :) %s를 사랑해 주셔서 정말 감사해요! 고객님 덕분에 저희가 더 열심히 할 수 있어요. 건강하게 꾸준히 즐겨주세요!", customerName, productName);
            } else {
                return String.format("안녕하세요, %s. 불편함을 드려 정말 죄송합니다. 고객님의 소중한 의견 잘 전달하겠습니다. 문제 해결을 위해 1:1 문의로 연락 주시면 신속하게 도와드리겠습니다!", customerName);
            }
        }
    }

    private String determineReplyStatus(int rating, boolean isUrgent) {
        if (isUrgent) return "MANAGER_REQUIRED";
        if (rating == 5) return "READY";
        if (rating == 4) return "REVIEW_REQUIRED";
        return "MANAGER_REQUIRED";
    }

    public Map<String, Object> getDashboardData() {
        Map<String, Object> result = new HashMap<>();
        List<AiReview> allReviews = reviewRepository.findAllOrderByReviewDateDesc();
        result.put("totalReviews", allReviews.size());
        List<AiReview> hifreeReviews = allReviews.stream()
            .filter(r -> "하이프리".equals(r.getBrand())).collect(Collectors.toList());
        List<AiReview> gukminReviews = allReviews.stream()
            .filter(r -> "국민한상".equals(r.getBrand())).collect(Collectors.toList());
        result.put("hifree", buildBrandStats(hifreeReviews));
        result.put("gukmin", buildBrandStats(gukminReviews));
        result.put("recentReviews", allReviews.stream().limit(20).collect(Collectors.toList()));
        result.put("stats", buildDistributionStats());
        return result;
    }

    /** 별점 분포 + 감성 분포 — 전체 및 브랜드별 (그래프용, 쿼리 1번) */
    private Map<String, Object> buildDistributionStats() {
        Map<String, Object> byBrand = new HashMap<>();
        long[] totalRating = new long[6];
        Map<String, Long> totalSentiment = new HashMap<>();
        jdbcTemplate.query("""
                SELECT COALESCE(r.brand, '기타') AS brand, r.rating,
                       COALESCE(a.sentiment, 'NEUTRAL') AS sentiment, COUNT(*) AS cnt
                FROM ai_reviews r
                LEFT JOIN ai_review_analyses a ON a.review_id = r.id
                GROUP BY 1, 2, 3
                """, rs -> {
            String brand = rs.getString("brand");
            int rating = Math.min(5, Math.max(1, rs.getInt("rating")));
            String sentiment = rs.getString("sentiment");
            long cnt = rs.getLong("cnt");
            @SuppressWarnings("unchecked")
            Map<String, Object> b = (Map<String, Object>) byBrand.computeIfAbsent(brand, k -> {
                Map<String, Object> m = new HashMap<>();
                m.put("rating", new long[6]);
                m.put("sentiment", new HashMap<String, Long>());
                return m;
            });
            ((long[]) b.get("rating"))[rating] += cnt;
            @SuppressWarnings("unchecked")
            Map<String, Long> sm = (Map<String, Long>) b.get("sentiment");
            sm.merge(sentiment, cnt, Long::sum);
            totalRating[rating] += cnt;
            totalSentiment.merge(sentiment, cnt, Long::sum);
        });
        Map<String, Object> stats = new HashMap<>();
        Map<String, Object> total = new HashMap<>();
        total.put("rating", ratingMap(totalRating));
        total.put("sentiment", totalSentiment);
        stats.put("total", total);
        for (Map.Entry<String, Object> e : byBrand.entrySet()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> b = (Map<String, Object>) e.getValue();
            Map<String, Object> out = new HashMap<>();
            out.put("rating", ratingMap((long[]) b.get("rating")));
            out.put("sentiment", b.get("sentiment"));
            stats.put(e.getKey(), out);
        }
        return stats;
    }

    private static Map<String, Long> ratingMap(long[] counts) {
        Map<String, Long> m = new LinkedHashMap<>();
        for (int i = 5; i >= 1; i--) m.put(String.valueOf(i), counts[i]);
        return m;
    }

    /** 전체 리뷰 페이지 조회 (+ 해당 페이지 분석 결과) */
    public Map<String, Object> getReviewPage(int page, int size, String brand) {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(
                Math.max(0, page), Math.min(100, Math.max(1, size)),
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "reviewDate")
                        .and(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "id")));
        org.springframework.data.domain.Page<AiReview> result = (brand == null || brand.isBlank())
                ? reviewRepository.findAll(pageable)
                : reviewRepository.findByBrand(brand, pageable);
        List<Long> ids = result.getContent().stream().map(AiReview::getId).toList();
        List<AiReviewAnalysis> analyses = ids.isEmpty() ? List.of() : analysisRepository.findByReviewIdIn(ids);
        Map<String, Object> body = new HashMap<>();
        body.put("content", result.getContent());
        body.put("analyses", analyses);
        body.put("page", result.getNumber());
        body.put("totalPages", result.getTotalPages());
        body.put("totalElements", result.getTotalElements());
        return body;
    }

    private Map<String, Object> buildBrandStats(List<AiReview> reviews) {
        Map<String, Object> stats = new HashMap<>();
        stats.put("total", reviews.size());
        double avg = reviews.stream().mapToInt(AiReview::getRating).average().orElse(0);
        stats.put("avgRating", Math.round(avg * 10.0) / 10.0);
        return stats;
    }

    public Map<String, Object> getVocData() {
        Map<String, Object> result = new HashMap<>();
        List<AiReview> all = reviewRepository.findAllOrderByReviewDateDesc();
        Map<String, Long> brandCount = all.stream()
            .collect(Collectors.groupingBy(r -> r.getBrand() != null ? r.getBrand() : "기타", Collectors.counting()));
        result.put("brandStats", brandCount);
        return result;
    }

    /** 실데이터 기반 인사이트 — 하드코딩 문구 대신 실제 리뷰·분석 결과에서 계산 */
    public List<Map<String, Object>> getInsights() {
        List<Map<String, Object>> insights = new ArrayList<>();
        List<AiReview> all = reviewRepository.findAllOrderByReviewDateDesc();
        if (all.isEmpty()) return insights;

        Map<String, List<AiReview>> byBrand = all.stream()
                .collect(Collectors.groupingBy(r -> r.getBrand() == null ? "기타" : r.getBrand()));
        for (Map.Entry<String, List<AiReview>> e : byBrand.entrySet()) {
            List<AiReview> reviews = e.getValue();
            double avg = reviews.stream().mapToInt(AiReview::getRating).average().orElse(0);
            long negative = reviews.stream().filter(r -> r.getRating() <= 2).count();
            Map<String, Long> keywordCount = new HashMap<>();
            for (AiReview r : reviews) {
                analysisRepository.findByReviewId(r.getId()).ifPresent(a -> {
                    if (a.getKeywords() != null) {
                        for (String k : a.getKeywords().split(",")) {
                            String key = k.trim();
                            if (!key.isEmpty()) keywordCount.merge(key, 1L, Long::sum);
                        }
                    }
                });
            }
            String topKeywords = keywordCount.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .limit(3).map(Map.Entry::getKey).collect(Collectors.joining(", "));
            StringBuilder text = new StringBuilder();
            text.append("리뷰 ").append(reviews.size()).append("건 · 평균 ")
                    .append(Math.round(avg * 10.0) / 10.0).append("점");
            if (negative > 0) {
                text.append(" · 부정(1~2점) ").append(negative).append("건 (")
                        .append(Math.round(negative * 100.0 / reviews.size())).append("%)");
            }
            if (!topKeywords.isEmpty()) text.append(" · 주요 키워드: ").append(topKeywords);
            Map<String, Object> insight = new HashMap<>();
            insight.put("brand", e.getKey());
            insight.put("text", text.toString());
            insight.put("date", LocalDate.now().toString());
            insights.add(insight);
        }
        long urgent = analysisRepository.countByIsUrgentTrue();
        if (urgent > 0) {
            Map<String, Object> alert = new HashMap<>();
            alert.put("brand", "전체");
            alert.put("text", "긴급 키워드(환불·불량·상함 등) 포함 리뷰 " + urgent + "건 — VOC 센터에서 우선 확인이 필요합니다.");
            alert.put("date", LocalDate.now().toString());
            insights.add(0, alert);
        }
        return insights;
    }
}
