package naeil.dashboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * L0 field-input layer: raw sales entries typed in directly by operations staff.
   * Additive-only entity, does not replace existing DailySalesStats/Orders data.
   */
@Entity
  @Table(
    name = "field_sales_entry",
    indexes = {
      @Index(name = "idx_field_sales_entry_company_date", columnList = "company_id, entry_date"),
      @Index(name = "idx_field_sales_entry_product", columnList = "company_id, product_id")
    }
    )
  @Getter
  @Setter
  @NoArgsConstructor(access = AccessLevel.PROTECTED)
  @AllArgsConstructor
  @Builder
  public class FieldSalesEntry {

@Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

@Column(name = "company_id", nullable = false)
    private Long companyId;

@Column(name = "brand_id")
    private Long brandId;

@Column(name = "product_id")
    private Long productId;

@Column(name = "channel_name", length = 100)
    private String channelName;

@Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

@Column(name = "quantity", nullable = false)
    @Builder.Default
    private Integer quantity = 0;

@Column(name = "sales_amount", nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal salesAmount = BigDecimal.ZERO;

      @Column(name = "cost_amount", nullable = false, precision = 14, scale = 2)
      @Builder.Default
      private BigDecimal costAmount = BigDecimal.ZERO;

@Column(name = "memo", length = 500)
    private String memo;

@Column(name = "created_by", length = 100)
    private String createdBy;

@CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

@UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
  }
