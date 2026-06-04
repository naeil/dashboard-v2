package naeil.dashboard.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record BrandMonitoringSearchResponse(
        String keyword,
        LocalDateTime searchedAt,
        BrandMonitoringSummaryDto summary,
        List<String> insights,
        List<Map<String, Object>> postingWindows,
        List<BrandMonitoringResultDto> results
) {
}
