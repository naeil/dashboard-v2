package naeil.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "channel_api_credentials")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChannelApiCredential {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "channel_type", nullable = false, unique = true, length = 50)
    private String channelType;

    @Column(name = "credential_key1", columnDefinition = "TEXT")
    private String credentialKey1;

    @Column(name = "credential_key2", columnDefinition = "TEXT")
    private String credentialKey2;

    @Column(name = "credential_key3", columnDefinition = "TEXT")
    private String credentialKey3;

    @Column(name = "credential_key4", columnDefinition = "TEXT")
    private String credentialKey4;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

    @Column(name = "last_sync_status", length = 50)
    private String lastSyncStatus;

    @Column(name = "last_sync_message", columnDefinition = "TEXT")
    private String lastSyncMessage;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
}
