package naeil.dashboard.controller;

import java.time.LocalDate;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.BrandMonitoringSearchResponse;
import naeil.dashboard.service.MarketingAgentService;
import naeil.dashboard.service.MarketingService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/marketing")
@RequiredArgsConstructor
public class MarketingController {

    private final MarketingService marketingService;
    private final MarketingAgentService marketingAgentService;

    @GetMapping("/keyword-trend/search")
    public ResponseEntity<BrandMonitoringSearchResponse> searchKeywordTrend(@RequestParam String keyword) {
        return ResponseEntity.ok(marketingService.searchKeywordTrend(keyword));
    }


    @GetMapping("/keyword-trend/linked-keywords")
    public ResponseEntity<Map<String, Object>> getLinkedSearchKeywords(
            @RequestParam(defaultValue = "ALL") String adType,
            @RequestParam(defaultValue = "30") int limit
    ) {
        return ResponseEntity.ok(marketingService.getLinkedSearchKeywords(adType, limit));
    }
    @GetMapping("/naver-cpc/performance")
    public ResponseEntity<Map<String, Object>> getNaverCpcPerformance(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "ALL") String adType,
            @RequestParam(required = false) String query
    ) {
        return ResponseEntity.ok(marketingService.getNaverCpcPerformance(from, to, adType, query));
    }

    @GetMapping("/meta-ads/performance")
    public ResponseEntity<Map<String, Object>> getMetaAdsPerformance(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "campaign") String level
    ) {
        return ResponseEntity.ok(marketingService.getMetaAdsPerformance(from.toString(), to.toString(), level));
    }

    @GetMapping("/meta-ads/creatives")
    public ResponseEntity<Map<String, Object>> getMetaAdCreatives(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(marketingService.getMetaAdCreatives(from.toString(), to.toString()));
    }

    @GetMapping("/ai-analysis/summary")
    public ResponseEntity<Map<String, Object>> getAiAnalysisSummary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(marketingService.getAiAnalysisSummary(from, to));
    }

    @PostMapping("/agent/scenario")
    public ResponseEntity<Map<String, Object>> createMarketingAgentScenario(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(marketingAgentService.createScenario(payload));
    }

    @PostMapping("/agent/naver-blog/deploy")
    public ResponseEntity<Map<String, Object>> deployNaverBlog(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(marketingAgentService.deployNaverBlog(payload));
    }
}
