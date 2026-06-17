package naeil.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "incentive_summary")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class IncentiveSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "incentive_month", nullable = false, length = 7)
    private String incentiveMonth;

    @Column(name = "employee_name", nullable = false, length = 100)
    private String employeeName;

    @Column(name = "online_incentive")
    @Builder.Default
    private Long onlineIncentive = 0L;

    @Column(name = "client_incentive")
    @Builder.Default
    private Long clientIncentive = 0L;

    @Column(name = "total_incentive")
    @Builder.Default
    private Long totalIncentive = 0L;

    @Column(name = "status", length = 30)
    @Builder.Default
    private String status = "EXPECTED";

    @Column(name = "memo", columnDefinition = "TEXT")
    private String memo;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
