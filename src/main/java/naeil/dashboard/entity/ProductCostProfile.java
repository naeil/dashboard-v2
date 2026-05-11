package naeil.dashboard.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(
        name = "product_cost_profile",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_product_cost_profile_company_product",
                        columnNames = {"company_id", "product_id"}
                )
        },
        indexes = {
                @Index(name = "idx_product_cost_profile_company", columnList = "company_id"),
                @Index(name = "idx_product_cost_profile_product", columnList = "product_id")
        }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ProductCostProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "sgna_cost", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal sgnaCost = BigDecimal.ZERO;

    @Column(name = "logistics_cost", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal logisticsCost = BigDecimal.ZERO;

    @Column(name = "packaging_cost", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal packagingCost = BigDecimal.ZERO;

    @Column(name = "other_cost", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal otherCost = BigDecimal.ZERO;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}
