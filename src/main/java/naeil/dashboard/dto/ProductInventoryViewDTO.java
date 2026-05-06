package naeil.dashboard.dto;

import java.time.LocalDateTime;

public record ProductInventoryViewDTO(
        Long productId,
        Long brandId,
        String brandName,
        String productName,
        String skuCd,
        Long prodNo,
        Integer realStock,
        Integer safeStock,
        Integer monthlyOutboundCount,
        LocalDateTime mdate
) {
}
