package kr.co.highfree.event.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.OffsetDateTime;

@Entity
@Table(name = "customers")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "phone_number", unique = true, nullable = false, length = 20)
    private String phoneNumber;

    @Column(name = "marketing_agree")
    private Boolean marketingAgree = false;

    @Column(name = "upup_user_id", length = 100)
    private String upupUserId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    public Customer() {}

    public Long getId() { return id; }
    public void setId(Long v) { this.id = v; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String v) { this.phoneNumber = v; }
    public Boolean getMarketingAgree() { return marketingAgree; }
    public void setMarketingAgree(Boolean v) { this.marketingAgree = v; }
    public String getUpupUserId() { return upupUserId; }
    public void setUpupUserId(String v) { this.upupUserId = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public static Builder builder() { return new Builder(); }
    public static class Builder {
        private final Customer o = new Customer();
        public Builder phoneNumber(String v) { o.phoneNumber=v; return this; }
        public Builder marketingAgree(Boolean v) { o.marketingAgree=v; return this; }
        public Customer build() { return o; }
    }
}
