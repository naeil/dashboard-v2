package kr.co.highfree.event.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "point_transactions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PointTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Column(name = "session_id", columnDefinition = "UUID")
    private UUID sessionId;

    @Column(nullable = false, length = 20)
    private String type; // EARN, USE, EXPIRE

    @Column(nullable = false)
    private Integer point;

    @Column(length = 500)
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
