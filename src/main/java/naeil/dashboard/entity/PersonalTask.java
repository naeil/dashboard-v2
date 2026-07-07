package naeil.dashboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * Personal task board entry for CEO Strategic Dashboard > personal task management.
   * category is one of INBOX, TODAY, WAITING, DONE.
   * Additive-only entity, does not affect any existing table.
   */
@Entity
  @Table(
            name = "personal_task",
            indexes = {
                              @Index(name = "idx_personal_task_company_category", columnList = "company_id, category, position")
            }
    )
  @Getter
  @Setter
  @NoArgsConstructor(access = AccessLevel.PROTECTED)
  @AllArgsConstructor
  @Builder
  public class PersonalTask {

    @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

    @Column(name = "company_id", nullable = false)
        private Long companyId;

    @Column(name = "category", nullable = false, length = 20)
        @Builder.Default
        private String category = "INBOX";

    @Column(name = "content", nullable = false, length = 500)
        private String content;

    @Column(name = "memo", length = 500)
        private String memo;

    @Column(name = "position", nullable = false)
        @Builder.Default
        private Integer position = 0;

    @Column(name = "created_by", length = 100)
        private String createdBy;

    @Column(name = "done_at")
        private LocalDateTime doneAt;

    @CreationTimestamp
        @Column(name = "created_at", nullable = false, updatable = false)
        private LocalDateTime createdAt;

    @UpdateTimestamp
        @Column(name = "updated_at", nullable = false)
        private LocalDateTime updatedAt;
  }
