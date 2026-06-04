package naeil.dashboard.dto;

public record BlogGenerateRequest(
        String topic,
        String keywords,
        String tone,
        String length,
        String category
) {}
