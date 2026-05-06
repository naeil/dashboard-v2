package naeil.dashboard.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import naeil.dashboard.enums.IntegrationType;

/**
 * DTO for time-series trend data grouped by platform.
 */
public record PlatformTrendSalesDTO(
        LocalDate date,
        IntegrationType platform,
        BigDecimal netRevenue
) {}
