package naeil.dashboard.dto;

import java.math.BigDecimal;

/**
 * JPA projection interface for product-level sales aggregation.
 * Used with Spring Data JPA interface-based projections — no entity loading.
 */
public interface ProductSalesDTO {
    Long getProductId();
    String getProductName();
    String getExternalProductId();
    Integer getCurrentRealStock();
    Long getTotalOrderCount();
    BigDecimal getTotalGrossAmount();
    BigDecimal getTotalDiscountAmount();
    BigDecimal getTotalNetRevenue();
    BigDecimal getTotalShippingFee();
    BigDecimal getAverageOrderValue();
}
