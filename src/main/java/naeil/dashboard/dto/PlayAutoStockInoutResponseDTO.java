package naeil.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PlayAutoStockInoutResponseDTO {

    private List<StockInoutItem> results;

    @JsonProperty("recordsTotal")
    private int recordsTotal;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class StockInoutItem {
        @JsonProperty("prod_no")
        private Long prodNo;

        @JsonProperty("sku_cd")
        private String skuCd;

        @JsonProperty("prod_name")
        private String prodName;

        @JsonProperty("brand")
        private String brand;

        @JsonProperty("inout_type")
        private String inoutType;

        @JsonProperty("out_cnt")
        private Integer outCnt;

        @JsonProperty("stock_cnt_real")
        private Integer stockCntReal;

        private String wdate;
    }
}
