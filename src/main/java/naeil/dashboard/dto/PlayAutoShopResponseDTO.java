package naeil.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PlayAutoShopResponseDTO {
    @JsonProperty("shop_no")
    private Integer shopNo;

    @JsonProperty("shop_name")
    private String shopName;

    @JsonProperty("shop_id")
    private String shopId; // storeCode/shopCode

    @JsonProperty("platform")
    private String platform;

    @JsonProperty("used")
    private Boolean used;
}
