package naeil.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
  @Table(name = "cs_auto_replies")
  @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
  public class CsAutoReply {

    @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

    @Column(name = "inq_uniq", nullable = false, length = 50)
        private String inqUniq;  // 플레이오토 문의 고유번호

    @Column(name = "inquiry_id")
        private Long inquiryId;  // cs_inquiries.id FK (소프트)

    @Column(name = "channel", length = 50)
        private String channel;

    @Column(name = "brand", length = 100)
        private String brand;

    @Column(name = "category", length = 50)
        private String category;  // 단순감사/상품문의/배송문의/교환반품/불만클레임/기타

    @Column(name = "risk_level", length = 20)
        private String riskLevel; // AUTO / QUEUE

    @Column(name = "confidence")
        private Double confidence; // 0.0~1.0

    @Column(name = "reply_title", length = 300)
        private String replyTitle;

    @Column(name = "reply_content", columnDefinition = "TEXT")
        private String replyContent;

    // 상태: DRAFT(초안)/PENDING(대기검수)/AUTO_SENT(자동발송완료)/MANUALLY_SENT(수동발송완료)/REJECTED(반려)
    @Column(name = "status", length = 30)
        @Builder.Default
        private String status = "DRAFT";

    @Column(name = "dry_run")
        @Builder.Default
        private Boolean dryRun = true;  // 드라이런 모드: 실제 발송 안 함

    @Column(name = "persona_version", length = 50)
        private String personaVersion;

    @Column(name = "rule_version", length = 50)
        private String ruleVersion;

    @Column(name = "sent_at")
        private LocalDateTime sentAt;

    @Column(name = "approved_by", length = 100)
        private String approvedBy;

    @Column(name = "approved_at")
        private LocalDateTime approvedAt;

    @Column(name = "playauto_result", columnDefinition = "TEXT")
        private String playautoResult;  // 플레이오토 API 응답 JSON

    @Column(name = "created_at")
        private LocalDateTime createdAt;

    @Column(name = "updated_at")
        private LocalDateTime updatedAt;

    @PrePersist
        protected void onCreate() {
                  createdAt = LocalDateTime.now();
                  updatedAt = LocalDateTime.now();
        }

    @PreUpdate
        protected void onUpdate() {
                  updatedAt = LocalDateTime.now();
        }
  }
