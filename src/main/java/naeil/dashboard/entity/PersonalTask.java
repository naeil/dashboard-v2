package naeil.dashboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.LocalDate;
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
  * boardDate is the date this task currently belongs to on the board (moves forward
                                                                       * automatically while unfinished). originalDate is the date it was first created and
  * never changes, used to detect and highlight overdue/carried-over tasks.
  * Additive-only entity, does not affect any existing table.
  */
@Entity
  @Table(
    name = "personal_task",
    indexes = {
      @Index(name = "idx_personal_task_company_category", columnList = "company_id, category, position"),
      @Index(name = "idx_personal_task_company_board_date", columnList = "company_id, board_date")
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

@Column(name = "board_date", nullable = false)
    @Builder.Default
    private LocalDate boardDate = LocalDate.now();

@Column(name = "original_date", nullable = false)
    @Builder.Default
    private LocalDate originalDate = LocalDate.now();

@CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

@UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

@Transient
    public boolean isOverdue() {
      return !"DONE".equals(category) && originalDate != null && boardDate != null && originalDate.isBefore(boardDate);
    }
  }
