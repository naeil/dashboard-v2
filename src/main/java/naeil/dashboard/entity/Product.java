package naeil.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "product", indexes = {
    @Index(name = "idx_product_company", columnList = "company_id"),
    @Index(name = "idx_product_brand", columnList = "company_id, brand_id")
})
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "brand_id", nullable = false)
    private Long brandId;

    @Column(name = "product_name", nullable = false, length = 200)
    private String productName;

    /** SKU 코드 */
    @Column(name = "sku_cd", length = 100)
    private String skuCd;

    /** PlayAuto 상품 번호 (prod_no) */
    @Column(name = "prod_no")
    private Long prodNo;

    @Column(name = "real_stock", nullable = false)
    @Builder.Default
    private Integer realStock = 0;

    @Column(name = "safe_stock", nullable = false)
    @Builder.Default
    private Integer safeStock = 0;

    @Column(name = "wdate")
    private LocalDateTime wdate;

    @Column(name = "mdate")
    private LocalDateTime mdate;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
