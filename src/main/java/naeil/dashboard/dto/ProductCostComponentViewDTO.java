package naeil.dashboard.dto;

import java.math.BigDecimal;

public record ProductCostComponentViewDTO(
        String componentName,
        BigDecimal amount,
        Integer sortOrder
) {
}
