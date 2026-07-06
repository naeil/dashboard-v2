package naeil.dashboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
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
 * L0 field-input layer: raw inbound/outbound/order-request entries typed in by warehouse staff.
   * entryType is a free-form code such as INBOUND, OUTBOUND or ORDER_REQUEST, validated in the service layer.
   * Additive-only entity, does not replace the existing ProductOutbound/PlayAuto sync data.
   */
@Entity
  @Table(
    name = "field_inventory_order_entry",
    indexes = {
      @Index(name = "idx_field_inv_order_entry_company_date", columnList = "company_id, entry_date"),
      @Index(name = "idx_field_inv_order_entry_product", columnList = "company_id, product_id")
    }
    )
  @Getter
  @Setter
  @NoArgsConstructor(access = AccessLevel.PROTECTED)
  @AllArgsConstructor
  @Builder
  public class FieldInventoryOrderEntry {

@Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

@Column(name = "company_id", nullable = false)
    private Long companyId;

@Column(name = "brand_id")
    private Long brandId;

@Column(name = "product_id")
    private Long productId;

@Column(name = "entry_type", nullable = false, length = 20)
    private String entryType;

@Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

@Column(name = "quantity", nullable = false)
    @Builder.Default
    private Integer quantity = 0;

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
