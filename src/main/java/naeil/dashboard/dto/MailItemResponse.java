package naeil.dashboard.dto;

import java.time.Instant;

public record MailItemResponse(
        String subject,
        String from,
        Instant receivedDate,
        boolean isRead,
        String preview
) {
}
