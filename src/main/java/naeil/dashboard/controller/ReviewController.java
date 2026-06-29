package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.common.ApiResponse;
import naeil.dashboard.entity.AiReview;
import naeil.dashboard.entity.AiReviewAnalysis;
import naeil.dashboard.service.AiReviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final AiReviewService reviewService;

    @PostMapping("/sync")
    public ResponseEntity<?> syncReviews(@RequestBody(required = false) Map<String, Object> body) {
        try {
            String channel = body != null ? (String) body.get("channel") : null;
            List<AiReview> mockReviews = generateMockReviews(channel);
            int saved = 0;
            int analyzed = 0;
            for (AiReview review : mockReviews) {
                AiReview saved_review = reviewService.saveReviewIfNotExists(review);
                if (saved_review != null) {
                    saved++;
                    AiReviewAnalysis analysis = reviewService.analyzeReview(saved_review);
                    if (analysis != null) analyzed++;
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("synced", saved);
            result.put("analyzed", analyzed);
            result.put("channel", channel != null ? channel : "all");
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Review sync failed", e);
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/analyze")
    public ResponseEntity<?> analyzeReview(@RequestBody Map<String, Object> body) {
        try {
            Long reviewId = Long.valueOf(body.get("reviewId").toString());
            Map<String, Object> result = new HashMap<>();
            result.put("reviewId", reviewId);
            result.put("status", "analyzed");
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/generate-reply")
    public ResponseEntity<?> generateReply(@RequestBody Map<String, Object> body) {
        try {
            Long reviewId = Long.valueOf(body.get("reviewId").toString());
            Map<String, Object> result = new HashMap<>();
            result.put("reviewId", reviewId);
            result.put("status", "draft_generated");
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboard() {
        try {
            Map<String, Object> data = reviewService.getDashboardData();
            return ResponseEntity.ok(ApiResponse.success(data));
        } catch (Exception e) {
            log.error("Dashboard data fetch failed", e);
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/voc")
    public ResponseEntity<?> getVoc() {
        try {
            Map<String, Object> data = reviewService.getVocData();
            return ResponseEntity.ok(ApiResponse.success(data));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/insights")
    public ResponseEntity<?> getInsights() {
        try {
            List<Map<String, Object>> insights = reviewService.getInsights();
            return ResponseEntity.ok(ApiResponse.success(insights));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    private List<AiReview> generateMockReviews(String channel) {
        List<AiReview> reviews = new ArrayList<>();
        String[] channels = channel != null ? new String[]{channel} : new String[]{"하이프리 스마트스토어", "국민한상 스마트스토어"};
        Random rand = new Random();
        for (String ch : channels) {
            boolean isHifree = ch.contains("하이프리");
            String brand = isHifree ? "하이프리" : "국민한상";
            String[] products = isHifree
                ? new String[]{"당근효소", "단백깡"}
                : new String[]{"국민한상 닭다리살", "국민한상 돈까스"};
            String[] reviews_content = isHifree
                ? new String[]{
                    "변비에 정말 효과적이에요. 재구매 확정!",
                    "붓기가 많이 빠졌어요. 만족합니다.",
                    "맥주안주로 정말 최고네요! 맛있어요",
                    "배송이 빨랐고 맛도 좋아요."
                }
                : new String[]{
                    "양이 많고 가격도 합리적이에요!",
                    "배송이 빠르고 품질이 좋아요. 재구매할게요.",
                    "맛있어요. 양도 많고 만족합니다.",
                    "가격 대비 품질이 정말 좋아요."
                };
            for (int i = 0; i < 2; i++) {
                String uniqueId = "MOCK_" + ch + "_" + System.currentTimeMillis() + "_" + rand.nextInt(10000);
                AiReview review = AiReview.builder()
                    .reviewId(uniqueId)
                    .channel(ch)
                    .brand(brand)
                    .productName(products[rand.nextInt(products.length)])
                    .optionName("기본")
                    .rating(3 + rand.nextInt(3))
                    .reviewContent(reviews_content[rand.nextInt(reviews_content.length)])
                    .reviewDate(LocalDateTime.now().minusHours(rand.nextInt(24)))
                    .customerName("고객**")
                    .orderNumber("ORD_" + rand.nextInt(999999))
                    .build();
                reviews.add(review);
            }
        }
        return reviews;
    }
        }
