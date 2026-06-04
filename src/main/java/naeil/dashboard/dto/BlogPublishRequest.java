package naeil.dashboard.dto;

public record BlogPublishRequest(
        String title,
        String content,
        String hashtags,
        String naverUsername,
        String naverPassword
) {}
