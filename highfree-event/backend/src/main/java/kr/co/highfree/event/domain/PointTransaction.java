package kr.co.highfree.event.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "point_transactions")
public class PointTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(name = "session_id", columnDefinition = "uuid")
    private UUID sessionId;

    @Column(nullable = false) private int points;

    @Column(name = "tx_type", length = 20)
    private String txType = "EARN";

    @Column(length = 200) private String description;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    public PointTransaction() {}

    public Long getId() { return id; }
    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer v) { this.customer = v; }
    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID v) { this.sessionId = v; }
    public int getPoints() { return points; }
    public void setPoints(int v) { this.points = v; }
    public String getTxType() { return txType; }
    public void setTxType(String v) { this.txType = v; }
    public String getDescription() { return description; }
    public void setDescription(String v) { this.description = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }

    public static Builder builder() { return new Builder(); }
    public static class Builder {
        private final PointTransaction o = new PointTransaction();
        public Builder customer(Customer v) { o.customer=v; return this; }
        public Builder sessionId(UUID v) { o.sessionId=v; return this; }
        public Builder points(int v) { o.points=v; return this; }
        public Builder txType(String v) { o.txType=v; return this; }
        public Builder description(String v) { o.description=v; return this; }
        public PointTransaction build() { return o; }
    }
}
