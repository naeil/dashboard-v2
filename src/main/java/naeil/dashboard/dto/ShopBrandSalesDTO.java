package naeil.dashboard.dto;

import java.math.BigDecimal;

/**
 * JPA projection interface for shop + brand cross-dimensional sales aggregation.
 */
public interface ShopBrandSalesDTO {
    Long getShopId();
    String getShopName();
    String getShopCode();
    Long getBrandId();
    String getBrandName();
    BigDecimal getTotalGrossAmount();
    BigDecimal getTotalDiscountAmount();
    BigDecimal getTotalNetRevenue();
    BigDecimal getTotalShippingFee();
}
