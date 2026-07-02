package kr.co.highfree.event.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "spin_results", uniqueConstraints = @UniqueConstraint(columnNames = "session_id"))
public class SpinResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", unique = true, nullable = false, columnDefinition = "uuid")
    private UUID sessionId;

    @Column(name = "reward_key", length = 50) private String rewardKey;
    @Column(name = "reward_label", length = 100) private String rewardLabel;
    @Column(name = "reward_points") private int rewardPoints;
    @Column(name = "is_retry") private boolean isRetry;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    public SpinResult() {}

    public Long getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID v) { this.sessionId = v; }
    public String getRewardKey() { return rewardKey; }
    public void setRewardKey(String v) { this.rewardKey = v; }
    public String getRewardLabel() { return rewardLabel; }
    public void setRewardLabel(String v) { this.rewardLabel = v; }
    public int getRewardPoints() { return rewardPoints; }
    public void setRewardPoints(int v) { this.rewardPoints = v; }
    public boolean isRetry() { return isRetry; }
    public void setRetry(boolean v) { this.isRetry = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }

    public static Builder builder() { return new Builder(); }
    public static class Builder {
        private final SpinResult o = new SpinResult();
        public Builder sessionId(UUID v) { o.sessionId=v; return this; }
        public Builder rewardKey(String v) { o.rewardKey=v; return this; }
        public Builder rewardLabel(String v) { o.rewardLabel=v; return this; }
        public Builder rewardPoints(int v) { o.rewardPoints=v; return this; }
        public Builder isRetry(boolean v) { o.isRetry=v; return this; }
        public SpinResult build() { return o; }
    }
}
