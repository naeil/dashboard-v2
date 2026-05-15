package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.BrandMonitoringSearchResponse;
import naeil.dashboard.service.BrandMonitoringService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/brand-monitoring")
@RequiredArgsConstructor
public class BrandMonitoringController {

    private final BrandMonitoringService brandMonitoringService;

    @GetMapping("/search")
    public ResponseEntity<BrandMonitoringSearchResponse> search(
            @RequestParam String keyword
    ) {
        return ResponseEntity.ok(brandMonitoringService.search(keyword));
    }
}
