package naeil.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "daily_sales_stats",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uq_daily_sales",
            columnNames = {"company_id", "date", "shop_id", "brand_id", "product_id"}
        )
    },
    indexes = {
        @Index(name = "idx_sales_company_date",           columnList = "company_id, date"),
        @Index(name = "idx_sales_company_date_brand",     columnList = "company_id, date, brand_id"),
        @Index(name = "idx_sales_company_date_shop",      columnList = "company_id, date, shop_id")
    }
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class DailySalesStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "shop_id", nullable = false)
    private Long shopId;

    @Column(name = "brand_id", nullable = false)
    private Long brandId;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    /** 총 결제 금액 (할인 전) */
    @Column(name = "gross_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal grossAmount;

    /** 할인 금액 */
    @Column(name = "discount_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal discountAmount;

    /** 순 매출 = grossAmount - discountAmount */
    @Column(name = "net_revenue", nullable = false, precision = 18, scale = 2)
    private BigDecimal netRevenue;

    /** 배송비 */
    @Column(name = "shipping_fee", nullable = false, precision = 18, scale = 2)
    private BigDecimal shippingFee;

    /** 취소 금액 */
    @Column(name = "cancel_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal cancelAmount;

    /** 주문자 수 (건수) */
    @Column(name = "orderer_count", nullable = false)
    private Integer ordererCount;

    /** 취소 건수 */
    @Column(name = "cancel_count", nullable = false)
    private Integer cancelCount;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}
