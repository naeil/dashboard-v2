package kr.co.highfree.event.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "spin_results")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SpinResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", unique = true, nullable = false, columnDefinition = "UUID")
    private UUID sessionId;

    @Column(name = "reward_key", nullable = false, length = 50)
    private String rewardKey;

    @Column(name = "reward_label", nullable = false, length = 200)
    private String rewardLabel;

    @Column(name = "reward_points", nullable = false)
    @Builder.Default
    private Integer rewardPoints = 0;

    @Column(name = "is_retry")
    @Builder.Default
    private Boolean isRetry = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
