package naeil.dashboard.controller;

import java.time.LocalDate;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.BrandMonitoringSearchResponse;
import naeil.dashboard.service.MarketingService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/marketing")
@RequiredArgsConstructor
public class MarketingController {

    private final MarketingService marketingService;

    @GetMapping("/keyword-trend/search")
    public ResponseEntity<BrandMonitoringSearchResponse> searchKeywordTrend(@RequestParam String keyword) {
        return ResponseEntity.ok(marketingService.searchKeywordTrend(keyword));
    }

    @GetMapping("/naver-cpc/performance")
    public ResponseEntity<Map<String, Object>> getNaverCpcPerformance(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(marketingService.getNaverCpcPerformance(from, to));
    }

    @GetMapping("/meta-ads/performance")
    public ResponseEntity<Map<String, Object>> getMetaAdsPerformance(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(marketingService.getMetaAdsPerformance(from, to));
    }

    @GetMapping("/ai-analysis/summary")
    public ResponseEntity<Map<String, Object>> getAiAnalysisSummary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(marketingService.getAiAnalysisSummary(from, to));
    }
}
