package naeil.dashboard.dto;

import java.math.BigDecimal;

/**
 * JPA projection interface for brand-level sales aggregation.
 */
public interface BrandSalesDTO {
    Long getBrandId();
    String getBrandName();
    BigDecimal getTotalGrossAmount();
    BigDecimal getTotalDiscountAmount();
    BigDecimal getTotalNetRevenue();
    BigDecimal getTotalShippingFee();
}
