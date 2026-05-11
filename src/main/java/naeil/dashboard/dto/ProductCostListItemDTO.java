package naeil.dashboard.dto;

import java.math.BigDecimal;

public interface ProductCostListItemDTO {
    Long getProductId();
    Long getBrandId();
    String getBrandName();
    String getProductName();
    String getSkuCd();
    Long getProdNo();
    BigDecimal getSalePrice();
    BigDecimal getCostPrice();
    BigDecimal getSupplyPrice();
    BigDecimal getSgnaCost();
    BigDecimal getLogisticsCost();
    BigDecimal getPackagingCost();
    BigDecimal getOtherCost();
    Integer getRealStock();
    Integer getSafeStock();
}
