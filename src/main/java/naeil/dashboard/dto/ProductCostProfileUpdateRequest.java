package naeil.dashboard.dto;

import java.math.BigDecimal;
import java.util.List;

public record ProductCostProfileUpdateRequest(
        BigDecimal salePrice,
        BigDecimal costPrice,
        BigDecimal supplyPrice,
        BigDecimal sgnaCost,
        BigDecimal logisticsCost,
        BigDecimal packagingCost,
        BigDecimal otherCost,
        List<ProductCostComponentUpdateRequest> costComponents
) {
}
