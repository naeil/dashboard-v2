package naeil.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_review_analyses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiReviewAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "review_id", nullable = false)
    private Long reviewId;

    @Column(name = "sentiment", nullable = false, length = 20)
    private String sentiment;

    @Column(name = "is_urgent", nullable = false)
    private Boolean isUrgent;

    @Column(name = "urgent_keywords", columnDefinition = "TEXT")
    private String urgentKeywords;

    @Column(name = "keywords", columnDefinition = "TEXT")
    private String keywords;

    @Column(name = "reply_draft", columnDefinition = "TEXT")
    private String replyDraft;

    @Column(name = "reply_status", nullable = false, length = 30)
    private String replyStatus;

    @Column(name = "analysis_status", nullable = false, length = 30)
    private String analysisStatus;

    @Column(name = "analyzed_at")
    private LocalDateTime analyzedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (sentiment == null) sentiment = "NEUTRAL";
        if (isUrgent == null) isUrgent = false;
        if (replyStatus == null) replyStatus = "PENDING";
        if (analysisStatus == null) analysisStatus = "PENDING";
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
