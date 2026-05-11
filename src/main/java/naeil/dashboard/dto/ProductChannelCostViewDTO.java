package naeil.dashboard.dto;

import java.math.BigDecimal;

public record ProductChannelCostViewDTO(
        Long shopId,
        String shopName,
        String shopCode,
        String channelFeeType,
        BigDecimal channelFeeValue,
        BigDecimal adCost,
        BigDecimal returnExchangeCost
) {
}
