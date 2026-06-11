package naeil.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

/**
 * 프로모션 내역 DTO
   * - 서식 저장(submit) 시 promotion_history 테이블에 연동된 데이터
              * - 채널별(online/offline/export) 목표 매출, 실시간 매출, 실시간 영업이익 포함
 */
public class PromotionHistoryDTO {

    /** 실적 업데이트 요청 (실시간 매출/수량 갱신) */
    @Data
      @Builder
      @NoArgsConstructor
      @AllArgsConstructor
      public static class ActualUpdateRequest {
                private Long       id;
                private Integer    actualQty;
                private BigDecimal actualRevenue;
                private BigDecimal actualCogs;
                private BigDecimal actualLogistics;
                private BigDecimal actualMarketing;
                private BigDecimal actualPlatformFee;
                private BigDecimal actualOtherCost;
      }

    /** 프로모션 내역 단건 응답 */
    @Data
      @Builder
      @NoArgsConstructor
      @AllArgsConstructor
      public static class Response {
                private Long       id;
                private Long       companyId;
                private Long       formId;
                private String     createdBy;

          /** online | offline | export */
          private String     channel;
                private String     promotionType;
                private String     productName;
                private String     skuCode;

          // ── 목표 ──────────────────────────────
          private BigDecimal targetRevenue;
                private Integer    targetQty;
                private BigDecimal targetOperatingProfit;

          // ── 실적 (실시간) ──────────────────────
          private Integer    actualQty;
                private BigDecimal actualRevenue;
                private BigDecimal actualCogs;
                private BigDecimal actualLogistics;
                private BigDecimal actualMarketing;
                private BigDecimal actualPlatformFee;
                private BigDecimal actualOtherCost;

          /** 실시간 영업이익 = actualRevenue - 모든 비용 (DB GENERATED) */
          private BigDecimal actualOperatingProfit;

          /** 달성률(%) = actualRevenue / targetRevenue * 100 (DB GENERATED) */
          private BigDecimal revenueAchievementRate;

          @JsonFormat(pattern = "yyyy-MM-dd")
                private LocalDate  promoStartDate;
                @JsonFormat(pattern = "yyyy-MM-dd")
                private LocalDate  promoEndDate;

          @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ssXXX")
                private OffsetDateTime submittedAt;
                @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ssXXX")
                private OffsetDateTime lastSyncedAt;

          private String     memo;

          @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ssXXX")
                private OffsetDateTime createdAt;
                @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ssXXX")
                private OffsetDateTime updatedAt;
      }

    /** 채널별 집계 요약 응답 */
    @Data
      @Builder
      @NoArgsConstructor
      @AllArgsConstructor
      public static class ChannelSummary {
                /** online | offline | export */
          private String     channel;
                private int        promotionCount;

          private BigDecimal totalTargetRevenue;
                private BigDecimal totalActualRevenue;
                private BigDecimal totalActualOperatingProfit;

          /** 전체 달성률(%) */
          private BigDecimal overallAchievementRate;

          private List<Response> items;
      }
}
