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
 * L0 field-input layer: raw "other cost" entries (logistics, SG and A, viral/review/blog/thumbnail
                                                    * marketing costs, promotions, etc.) typed in directly by operations staff.
   * costCategory is free text chosen by the user (logistics fee, SG and A, viral marketing fee, etc).
   * Additive-only entity, feeds the L2 operating-profit aggregation together with sales and ad cost.
   */
@Entity
  @Table(
    name = "field_other_cost_entry",
    indexes = {
      @Index(name = "idx_field_other_cost_entry_company_date", columnList = "company_id, entry_date"),
      @Index(name = "idx_field_other_cost_entry_brand", columnList = "company_id, brand_id")
    }
    )
  @Getter
  @Setter
  @NoArgsConstructor(access = AccessLevel.PROTECTED)
  @AllArgsConstructor
  @Builder
  public class FieldOtherCostEntry {

@Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

@Column(name = "company_id", nullable = false)
    private Long companyId;

@Column(name = "brand_id")
    private Long brandId;

@Column(name = "product_id")
    private Long productId;

@Column(name = "cost_category", nullable = false, length = 50)
    private String costCategory;

@Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

@Column(name = "amount", nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal amount = BigDecimal.ZERO;

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
