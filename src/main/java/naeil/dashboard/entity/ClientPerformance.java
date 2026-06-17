package naeil.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "client_performance")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ClientPerformance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_name", nullable = false, length = 200)
    private String clientName;

    @Column(name = "assignee_name", length = 100)
    private String assigneeName;

    @Column(name = "first_registered_date")
    private LocalDate firstRegisteredDate;

    @Column(name = "first_order_date")
    private LocalDate firstOrderDate;

    @Column(name = "first_order_amount")
    @Builder.Default
    private Long firstOrderAmount = 0L;

    @Column(name = "cumulative_sales")
    @Builder.Default
    private Long cumulativeSales = 0L;

    @Column(name = "cumulative_operating_profit")
    @Builder.Default
    private Long cumulativeOperatingProfit = 0L;

    @Column(name = "status", length = 30)
    @Builder.Default
    private String status = "LEAD";

    @Column(name = "memo", columnDefinition = "TEXT")
    private String memo;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
