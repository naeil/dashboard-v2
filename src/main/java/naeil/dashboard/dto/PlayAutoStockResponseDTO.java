package naeil.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PlayAutoStockResponseDTO {
    private List<StockItem> results;
    private int total;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class StockItem {
        @JsonProperty("sol_no")
        private Long solNo;

        @JsonProperty("prod_no")
        private Long prodNo;

        @JsonProperty("sku_cd")
        private String skuCd;

        @JsonProperty("prod_name")
        private String prodName;

        @JsonProperty("brand")
        private String brand;

        private String wdate;
        private String mdate;
        private List<Depot> depots;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Depot {
        @JsonProperty("depot_no")
        private Long depotNo;

        @JsonProperty("depot_name")
        private String depotName;

        @JsonProperty("real_stock")
        private Integer realStock;

        @JsonProperty("safe_stock")
        private Integer safeStock;
    }
}
