package naeil.dashboard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class IncentiveDto {

    // ==================== 온라인 성과 ====================

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class OnlinePerformanceRequest {
        private String performanceMonth;
        private String channelName;
        private String assigneeName;
        private Long salesAmount;
        private Long manufacturingCost;
        private Long advertisingCost;
        private Long commissionCost;
        private Long logisticsCost;
        private Long otherCost;
        private Boolean incentiveEligible;
        private String memo;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class OnlinePerformanceResponse {
        private Long id;
        private String performanceMonth;
        private String channelName;
        private String assigneeName;
        private Long salesAmount;
        private Long manufacturingCost;
        private Long advertisingCost;
        private Long commissionCost;
        private Long logisticsCost;
        private Long otherCost;
        private Long operatingProfit;
        private Boolean incentiveEligible;
        private Long expectedIncentive;
        private String memo;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    // ==================== 거래처 성과 ====================

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ClientPerformanceRequest {
        private String clientName;
        private String assigneeName;
        private LocalDate firstRegisteredDate;
        private LocalDate firstOrderDate;
        private Long firstOrderAmount;
        private Long cumulativeSales;
        private Long cumulativeOperatingProfit;
        /** 상품별 고정 마진율 (%, 예: 25.0 = 25%) */
        private Double marginRate;
        private String status;
        private String memo;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ClientPerformanceResponse {
        private Long id;
        private String clientName;
        private String assigneeName;
        private LocalDate firstRegisteredDate;
        private LocalDate firstOrderDate;
        private Long firstOrderAmount;
        private Long cumulativeSales;
        private Long cumulativeOperatingProfit;
        /** 상품별 고정 마진율 (%) */
        private Double marginRate;
        /** 매출 등급 (Tier1/Tier2/Tier3) */
        private String tierLabel;
        private String status;
        /** 신규 거래처 등록 인센티브 (고정 50,000원) */
        private Long newClientIncentive;
        /** 첫 발주 인센티브 = 추정영업이익 x 1% */
        private Long firstOrderIncentive;
        /** 누적 인센티브 = 추정영업이익 x 등급% */
        private Long cumulativeSalesIncentive;
        /** 총 예상 인센티브 (신규+첫발주+누적) */
        private Long totalExpectedIncentive;
        private String memo;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    // ==================== 직원별 인센티브 요약 ====================

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class IncentiveSummaryResponse {
        private Long id;
        private String incentiveMonth;
        private String employeeName;
        private Long onlineIncentive;
        private Long clientIncentive;
        private Long totalIncentive;
        private String status;
        private String memo;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    // ==================== KPI ====================

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class IncentiveKpiResponse {
        private String month;
        private Long monthlyOnlineSales;
        private Long monthlyOnlineOperatingProfit;
        private Long onlineIncentivePool;
        private Long newClientCount;
        private Long firstOrderClientCount;
        private Long clientCumulativeSales;
        private Long totalExpectedIncentive;
    }
}
