package naeil.dashboard.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(
        name = "product_channel_cost",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_product_channel_cost_company_product_shop",
                        columnNames = {"company_id", "product_id", "shop_id"}
                )
        },
        indexes = {
                @Index(name = "idx_product_channel_cost_company", columnList = "company_id"),
                @Index(name = "idx_product_channel_cost_product", columnList = "product_id"),
                @Index(name = "idx_product_channel_cost_shop", columnList = "shop_id")
        }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ProductChannelCost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "shop_id", nullable = false)
    private Long shopId;

    @Column(name = "channel_fee_type", nullable = false, length = 20)
    @Builder.Default
    private String channelFeeType = "RATE";

    @Column(name = "channel_fee_value", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal channelFeeValue = BigDecimal.ZERO;

    @Column(name = "ad_cost", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal adCost = BigDecimal.ZERO;

    @Column(name = "return_exchange_cost", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal returnExchangeCost = BigDecimal.ZERO;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}
