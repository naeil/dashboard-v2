package naeil.dashboard.dto;

import java.time.LocalDateTime;

public interface ProductInventoryDTO {
    Long getProductId();
    Long getBrandId();
    String getBrandName();
    String getProductName();
    String getSkuCd();
    Long getProdNo();
    Integer getRealStock();
    Integer getSafeStock();
    LocalDateTime getMdate();
}
