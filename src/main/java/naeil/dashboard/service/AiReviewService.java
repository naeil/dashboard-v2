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
        return result;
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

    public List<Map<String, Object>> getInsights() {
        List<Map<String, Object>> insights = new ArrayList<>();
        Map<String, Object> i1 = new HashMap<>();
        i1.put("brand", "하이프리");
        i1.put("text", "당근효소 고객은 변비보다 붓기 개선 목적으로 구매하는 비중이 증가하고 있습니다.");
        i1.put("date", LocalDate.now().toString());
        insights.add(i1);
        Map<String, Object> i2 = new HashMap<>();
        i2.put("brand", "하이프리");
        i2.put("text", "단백깡 리뷰에서 맥주안주 언급량이 증가하고 있습니다.");
        i2.put("date", LocalDate.now().toString());
        insights.add(i2);
        Map<String, Object> i3 = new HashMap<>();
        i3.put("brand", "국민한상");
        i3.put("text", "국민한상 제품군은 배송 만족도가 전월 대비 상승했습니다.");
        i3.put("date", LocalDate.now().toString());
        insights.add(i3);
        return insights;
    }
}
