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
        private String status;
        private Long firstOrderIncentive;
        private Long cumulativeSalesIncentive;
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
