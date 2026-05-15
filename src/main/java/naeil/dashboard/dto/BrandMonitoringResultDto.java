package naeil.dashboard.dto;

public record BrandMonitoringResultDto(
        String channel,
        String title,
        String description,
        String link,
        String publishedAt
) {
}
