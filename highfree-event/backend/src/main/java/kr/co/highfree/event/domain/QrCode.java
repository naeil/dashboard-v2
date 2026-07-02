package kr.co.highfree.event.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "qr_codes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class QrCode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "qr_id", unique = true, nullable = false, length = 100)
    private String qrId;

    @Column(length = 10)
    private String country;

    @Column(length = 100)
    private String channel;

    @Column(length = 100)
    private String product;

    @Column(length = 100)
    private String flavor;

    @Column(length = 100)
    private String campaign;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
