package naeil.dashboard.dto;

import java.math.BigDecimal;

public interface ProductMarketSalesDTO {
    Long getShopId();
    String getShopName();
    String getShopCode();
    Long getTotalOrderCount();
    BigDecimal getTotalGrossAmount();
    BigDecimal getTotalDiscountAmount();
    BigDecimal getTotalNetRevenue();
    BigDecimal getTotalShippingFee();
    BigDecimal getAverageOrderValue();
    BigDecimal getBaseCostAmount();
    BigDecimal getChannelFeeAmount();
    BigDecimal getAdCostAmount();
    BigDecimal getReturnExchangeCostAmount();
    BigDecimal getProfitAmount();
    String getChannelFeeType();
    BigDecimal getChannelFeeValue();
    BigDecimal getAdCost();
    BigDecimal getReturnExchangeCost();
    BigDecimal getSalePrice();
    BigDecimal getCostPrice();
    BigDecimal getSupplyPrice();
    BigDecimal getSgnaCost();
    BigDecimal getLogisticsCost();
    BigDecimal getPackagingCost();
    BigDecimal getOtherCost();
}
