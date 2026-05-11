package naeil.dashboard.dto;

import java.math.BigDecimal;

public record ProductCostComponentUpdateRequest(
        String componentName,
        BigDecimal amount,
        Integer sortOrder
) {
}
