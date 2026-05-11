package naeil.dashboard.dto;

import java.math.BigDecimal;

public record ProductChannelCostUpdateRequest(
        String channelFeeType,
        BigDecimal channelFeeValue,
        BigDecimal adCost,
        BigDecimal returnExchangeCost
) {
}
