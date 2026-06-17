package naeil.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "online_channel_performance")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class OnlineChannelPerformance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "performance_month", nullable = false, length = 7)
    private String performanceMonth;

    @Column(name = "channel_name", nullable = false, length = 100)
    private String channelName;

    @Column(name = "assignee_name", length = 100)
    private String assigneeName;

    @Column(name = "sales_amount")
    @Builder.Default
    private Long salesAmount = 0L;

    @Column(name = "manufacturing_cost")
    @Builder.Default
    private Long manufacturingCost = 0L;

    @Column(name = "advertising_cost")
    @Builder.Default
    private Long advertisingCost = 0L;

    @Column(name = "commission_cost")
    @Builder.Default
    private Long commissionCost = 0L;

    @Column(name = "logistics_cost")
    @Builder.Default
    private Long logisticsCost = 0L;

    @Column(name = "other_cost")
    @Builder.Default
    private Long otherCost = 0L;

    @Column(name = "operating_profit")
    @Builder.Default
    private Long operatingProfit = 0L;

    @Column(name = "incentive_eligible")
    @Builder.Default
    private Boolean incentiveEligible = true;

    @Column(name = "memo", columnDefinition = "TEXT")
    private String memo;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public void recalculateOperatingProfit() {
        this.operatingProfit = (salesAmount == null ? 0 : salesAmount)
                - (manufacturingCost == null ? 0 : manufacturingCost)
                - (advertisingCost == null ? 0 : advertisingCost)
                - (commissionCost == null ? 0 : commissionCost)
                - (logisticsCost == null ? 0 : logisticsCost)
                - (otherCost == null ? 0 : otherCost);
    }
}
