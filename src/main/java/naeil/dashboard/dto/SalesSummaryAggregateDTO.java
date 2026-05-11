package naeil.dashboard.dto;

import java.math.BigDecimal;

public interface SalesSummaryAggregateDTO {
    BigDecimal getTotalGrossAmount();
    BigDecimal getTotalDiscountAmount();
    BigDecimal getTotalNetRevenue();
    BigDecimal getTotalShippingFee();
    BigDecimal getTotalCancelAmount();
    Long getCancelCount();
    Long getTotalOrderCount();
    BigDecimal getProfitAmount();
}
