package naeil.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 프로모션 마진 서식 DTO
   * - 직원이 프로모션 마진 카테고리에서 입력하는 폼 데이터
   * - "서식 저장" 클릭 시 promotion_margin_form 테이블에 저장되고
   *   status=submitted 로 변경 시 promotion_history 에 자동 연동됨
   */
public class PromotionMarginFormDTO {

    /** 서식 생성/수정 요청 */
    @Data
      @Builder
      @NoArgsConstructor
      @AllArgsConstructor
      public static class Request {
                private Long   companyId;
                private String formName;
                /** online | offline | export */
          private String channel;
                private String promotionType;
                private String productName;
                private String skuCode;

          private BigDecimal salePrice;
                private BigDecimal discountRate;
                private BigDecimal discountAmount;

          private BigDecimal cogs;
                private BigDecimal logisticsCost;
                private BigDecimal marketingCost;
                private BigDecimal platformFeeRate;
                private BigDecimal otherCost;

          private Integer targetQty;

          @JsonFormat(pattern = "yyyy-MM-dd")
                private LocalDate promoStartDate;
                @JsonFormat(pattern = "yyyy-MM-dd")
                private LocalDate promoEndDate;

          private String memo;
      }

    /** 서식 단건 응답 */
    @Data
      @Builder
      @NoArgsConstructor
      @AllArgsConstructor
      public static class Response {
                private Long       id;
                private Long       companyId;
                private String     createdBy;
                private String     formName;
                private String     channel;
                private String     promotionType;
                private String     productName;
                private String     skuCode;

          private BigDecimal salePrice;
                private BigDecimal discountRate;
                private BigDecimal discountAmount;

          private BigDecimal cogs;
                private BigDecimal logisticsCost;
                private BigDecimal marketingCost;
                private BigDecimal platformFeeRate;
                private BigDecimal otherCost;

          private Integer    targetQty;
                private BigDecimal targetRevenue;      // DB GENERATED 컬럼

          @JsonFormat(pattern = "yyyy-MM-dd")
                private LocalDate  promoStartDate;
                @JsonFormat(pattern = "yyyy-MM-dd")
                private LocalDate  promoEndDate;

          private String     status;
                private String     memo;

          @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ssXXX")
                private OffsetDateTime createdAt;
                @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ssXXX")
                private OffsetDateTime updatedAt;
      }
}
