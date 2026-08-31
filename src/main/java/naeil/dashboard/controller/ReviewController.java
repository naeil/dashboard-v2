package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.common.ApiResponse;
import naeil.dashboard.service.AiReviewService;
import naeil.dashboard.service.ReviewUploadService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final AiReviewService reviewService;
    private final ReviewUploadService reviewUploadService;

    /**
     * 실제 후기 업로드 — 스마트스토어/쿠팡 판매자센터에서 내려받은 리뷰 엑셀(.xlsx)·CSV.
     * 네이버·쿠팡 모두 공식 리뷰 조회 API가 없어(공식 확인) 업로드 방식으로 실데이터를 수집한다.
     */
    @PostMapping("/upload")
    public ResponseEntity<?> uploadReviews(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String channel
    ) {
        try {
            Map<String, Object> result = reviewUploadService.importFile(
                    file.getBytes(), file.getOriginalFilename(), channel);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Review upload failed", e);
            return ResponseEntity.status(500).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** (구) 목업 동기화 — 목업 생성 제거. 자동 수집 API가 없음을 안내한다. */
    @PostMapping("/sync")
    public ResponseEntity<?> syncReviews(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> result = new HashMap<>();
        result.put("synced", 0);
        result.put("message", "네이버·쿠팡은 공식 리뷰 API를 제공하지 않아 자동 수집이 불가합니다. [리뷰 엑셀 업로드]를 사용하세요.");
        return ResponseEntity.ok(ApiResponse.success(result));
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

    /** 전체 리뷰 페이지 조회 — page(0부터), size, brand 필터 */
    @GetMapping("/list")
    public ResponseEntity<?> listReviews(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String brand
    ) {
        try {
            return ResponseEntity.ok(ApiResponse.success(reviewService.getReviewPage(page, size, brand)));
        } catch (Exception e) {
            log.error("Review list fetch failed", e);
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
}
