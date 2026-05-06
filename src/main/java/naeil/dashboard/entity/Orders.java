package naeil.dashboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "orders", indexes = {
        @Index(name = "idx_orders_fk_shop", columnList = "shop_id"),
        @Index(name = "idx_orders_fk_product", columnList = "product_id"),
        @Index(name = "idx_orders_fk_customer", columnList = "customer_id"),
        @Index(name = "idx_orders_stats_main", columnList = "company_id, pay_time, brand_id")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Orders {

    @Id
    @Column(name = "uniq", length = 50)
    private String uniq;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "brand_id", nullable = false)
    private Long brandId;

    @Column(name = "shop_id", nullable = false)
    private Long shopId;

    @Column(name = "product_id")
    private Long productId;

    @Column(name = "customer_id")
    private Long customerId;

    @Column(name = "sku_cd", nullable = false, length = 100)
    private String skuCd;

    @Column(name = "gross_amt", precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal grossAmt = BigDecimal.ZERO;

    @Column(name = "discount_amt", precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal discountAmt = BigDecimal.ZERO;

    @Column(name = "shipping_fee", precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal shippingFee = BigDecimal.ZERO;

    @Column(name = "pay_amt", precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal payAmt = BigDecimal.ZERO;

    @Column(name = "cancel_amt", precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal cancelAmt = BigDecimal.ZERO;

    @Column(name = "ord_status", nullable = false, length = 50)
    private String ordStatus;

    @Column(name = "pay_time")
    private LocalDateTime payTime;

    @Column(name = "wdate")
    private LocalDateTime wdate;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public void setBrandId(Long brandId) {
        this.brandId = brandId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public void updateStatus(String status) {
        if (status != null && !status.trim().isEmpty()) {
            this.ordStatus = status.trim();
        }
    }

    public void markAsReversed(String status, BigDecimal amount) {
        updateStatus(status);
        if (amount != null) {
            this.cancelAmt = amount;
        } else {
            this.cancelAmt = this.payAmt;
        }
    }
}
