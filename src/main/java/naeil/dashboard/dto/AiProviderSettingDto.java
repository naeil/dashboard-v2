package naeil.dashboard.dto;

import java.time.LocalDateTime;
import java.util.List;
import naeil.dashboard.entity.AiProviderSetting;
import naeil.dashboard.enums.AiProvider;

public class AiProviderSettingDto {

    public record ProviderConfig(
            AiProvider provider,
            String label,
            String description,
            List<String> requiredFields,
            List<String> optionalFields,
            String apiVersion
    ) {}

    public record ValidateRequest(
            AiProvider provider,
            String apiKey,
            String organizationId,
            String projectId
    ) {}

    public record SaveRequest(
            AiProvider provider,
            String displayName,
            String apiKey,
            String organizationId,
            String projectId
    ) {
        public ValidateRequest toValidateRequest() {
            return new ValidateRequest(provider, apiKey, organizationId, projectId);
        }
    }

    public record Response(
            Long id,
            AiProvider provider,
            String displayName,
            String apiKeyMasked,
            String organizationIdMasked,
            String projectIdMasked,
            Boolean isActive,
            LocalDateTime validatedAt,
            LocalDateTime lastModelSyncedAt,
            LocalDateTime updatedAt
    ) {
        public static Response from(AiProviderSetting setting) {
            return new Response(
                    setting.getId(),
                    setting.getProvider(),
                    setting.getDisplayName(),
                    mask(setting.getApiKey()),
                    mask(setting.getOrganizationId()),
                    mask(setting.getProjectId()),
                    setting.getIsActive(),
                    setting.getValidatedAt(),
                    setting.getLastModelSyncedAt(),
                    setting.getUpdatedAt()
            );
        }
    }

    public record ModelOption(
            String value,
            String label
    ) {}

    private static String mask(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 4) {
            return "****";
        }
        return "*".repeat(Math.min(12, trimmed.length() - 4)) + trimmed.substring(trimmed.length() - 4);
    }
}
