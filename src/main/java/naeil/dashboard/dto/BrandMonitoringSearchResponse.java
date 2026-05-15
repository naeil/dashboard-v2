package naeil.dashboard.dto;

import java.time.LocalDateTime;
import java.util.List;

public record BrandMonitoringSearchResponse(
        String keyword,
        LocalDateTime searchedAt,
        BrandMonitoringSummaryDto summary,
        List<String> insights,
        List<BrandMonitoringResultDto> results
) {
}
