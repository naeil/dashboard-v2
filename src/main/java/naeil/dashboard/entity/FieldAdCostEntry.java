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
 * L0 field-input layer: raw ad-spend entries typed in directly by marketing/operations staff.
   * Additive-only entity, used to compute ROAS/CPA in the L1 aggregation layer.
   */
@Entity
  @Table(
    name = "field_ad_cost_entry",
    indexes = {
      @Index(name = "idx_field_ad_cost_entry_company_date", columnList = "company_id, entry_date"),
      @Index(name = "idx_field_ad_cost_entry_product", columnList = "company_id, product_id")
    }
    )
  @Getter
  @Setter
  @NoArgsConstructor(access = AccessLevel.PROTECTED)
  @AllArgsConstructor
  @Builder
  public class FieldAdCostEntry {

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

@Column(name = "ad_cost_amount", nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal adCostAmount = BigDecimal.ZERO;

@Column(name = "impressions", nullable = false)
    @Builder.Default
    private Integer impressions = 0;

@Column(name = "clicks", nullable = false)
    @Builder.Default
    private Integer clicks = 0;

@Column(name = "conversions", nullable = false)
    @Builder.Default
    private Integer conversions = 0;

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
