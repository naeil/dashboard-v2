package naeil.dashboard.dto;

import java.math.BigDecimal;
import java.util.List;

public record ProductCostViewDTO(
        Long productId,
        Long brandId,
        String brandName,
        String productName,
        String skuCd,
        Long prodNo,
        BigDecimal salePrice,
        BigDecimal costPrice,
        BigDecimal supplyPrice,
        BigDecimal sgnaCost,
        BigDecimal logisticsCost,
        BigDecimal packagingCost,
        BigDecimal otherCost,
        Integer realStock,
        Integer safeStock,
        Integer monthlyOutboundCount,
        List<ProductCostComponentViewDTO> costComponents,
        List<ProductChannelCostViewDTO> channelCosts
) {
}
