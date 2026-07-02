package kr.co.highfree.event.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.OffsetDateTime;

@Entity
@Table(name = "qr_codes")
public class QrCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "qr_id", unique = true, nullable = false, length = 100)
    private String qrId;

    @Column(length = 10) private String country;
    @Column(length = 50) private String channel;
    @Column(length = 100) private String product;
    @Column(length = 100) private String flavor;
    @Column(length = 100) private String campaign;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    public QrCode() {}

    public Long getId() { return id; }
    public String getQrId() { return qrId; }
    public void setQrId(String v) { this.qrId = v; }
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
        private final QrCode o = new QrCode();
        public Builder qrId(String v) { o.qrId=v; return this; }
        public Builder country(String v) { o.country=v; return this; }
        public Builder channel(String v) { o.channel=v; return this; }
        public Builder product(String v) { o.product=v; return this; }
        public Builder flavor(String v) { o.flavor=v; return this; }
        public Builder campaign(String v) { o.campaign=v; return this; }
        public QrCode build() { return o; }
    }
}
