package kr.co.highfree.event.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "event_sessions")
public class EventSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", unique = true, nullable = false, columnDefinition = "uuid")
    private UUID sessionId = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "qr_code_id")
    private QrCode qrCode;

    @Column(name = "ip_address", length = 45) private String ipAddress;
    @Column(name = "user_agent", length = 500) private String userAgent;
    @Column(length = 500) private String referrer;
    @Column(length = 10) private String country;
    @Column(length = 50) private String channel;
    @Column(length = 100) private String product;
    @Column(length = 100) private String flavor;
    @Column(length = 100) private String campaign;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    public EventSession() {}

    public Long getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID v) { this.sessionId = v; }
    public QrCode getQrCode() { return qrCode; }
    public void setQrCode(QrCode v) { this.qrCode = v; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String v) { this.ipAddress = v; }
    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String v) { this.userAgent = v; }
    public String getReferrer() { return referrer; }
    public void setReferrer(String v) { this.referrer = v; }
    public String getCountry() { return country; }
    public void setCountry(String v) { this.country = v; }
    public String getChannel() { return channel; }
    public void setChannel(String v) { this.channel = v; }
    public String getProduct() { return product; }
    public void setProduct(String v) { this.product = v; }
    public String getFlavor() { return flavor; }
    public void setFlavor(String v) { this.flavor = v; }
    public String getCampaign() { return campaign; }
    public void setCampaign(String v) { this.campaign = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }

    public static Builder builder() { return new Builder(); }
    public static class Builder {
        private final EventSession o = new EventSession();
        public Builder qrCode(QrCode v) { o.qrCode=v; return this; }
        public Builder ipAddress(String v) { o.ipAddress=v; return this; }
        public Builder userAgent(String v) { o.userAgent=v; return this; }
        public Builder referrer(String v) { o.referrer=v; return this; }
        public Builder country(String v) { o.country=v; return this; }
        public Builder channel(String v) { o.channel=v; return this; }
        public Builder product(String v) { o.product=v; return this; }
        public Builder flavor(String v) { o.flavor=v; return this; }
        public Builder campaign(String v) { o.campaign=v; return this; }
        public EventSession build() { return o; }
    }
}
