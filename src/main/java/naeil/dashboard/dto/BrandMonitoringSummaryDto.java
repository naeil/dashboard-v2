package naeil.dashboard.dto;

public record BrandMonitoringSummaryDto(
        int totalCount,
        int blogCount,
        int newsCount,
        int webCount
) {
}
