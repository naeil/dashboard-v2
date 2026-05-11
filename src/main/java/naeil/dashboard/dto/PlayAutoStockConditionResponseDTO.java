package naeil.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.List;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PlayAutoStockConditionResponseDTO {

    private List<StockConditionItem> results;

    @JsonProperty("recordsTotal")
    private int recordsTotal;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class StockConditionItem {
        @JsonProperty("prod_no")
        private Long prodNo;

        @JsonProperty("depot_no")
        private Long depotNo;

        @JsonProperty("depot_name")
        private String depotName;

        @JsonProperty("stock_status")
        private String stockStatus;

        @JsonProperty("sku_cd")
        private String skuCd;

        @JsonProperty("prod_img")
        private String prodImg;

        @JsonProperty("prod_name")
        private String prodName;

        @JsonProperty("brand")
        private String brand;

        @JsonProperty("sale_price")
        private BigDecimal salePrice;

        @JsonProperty("cost_price")
        private BigDecimal costPrice;

        @JsonProperty("supply_price")
        private BigDecimal supplyPrice;

        @JsonProperty("stock_cnt_real")
        private Integer stockCntReal;

        @JsonProperty("stock_cnt_safe")
        private Integer stockCntSafe;

        @JsonProperty("out_cnt_accum")
        private Integer outCntAccum;

        private String wdate;
        private String mdate;
    }
}
