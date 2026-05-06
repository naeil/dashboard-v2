package naeil.dashboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import naeil.dashboard.enums.CollectionExecutionStatus;
import naeil.dashboard.enums.CollectionJobType;
import naeil.dashboard.enums.IntegrationType;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "collection_execution_history", indexes = {
        @Index(name = "idx_collection_execution_history_main", columnList = "company_id, integration_type, started_at"),
        @Index(name = "idx_collection_execution_history_status", columnList = "status, started_at")
})
public class CollectionExecutionHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "integration_type", nullable = false, length = 50)
    private IntegrationType integrationType;

    @Enumerated(EnumType.STRING)
    @Column(name = "job_type", nullable = false, length = 20)
    private CollectionJobType jobType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CollectionExecutionStatus status;

    @Column(name = "message", columnDefinition = "TEXT")
    private String message;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected CollectionExecutionHistory() {
    }

    public CollectionExecutionHistory(
            Long companyId,
            IntegrationType integrationType,
            CollectionJobType jobType,
            CollectionExecutionStatus status,
            String message,
            LocalDateTime startedAt
    ) {
        this.companyId = companyId;
        this.integrationType = integrationType;
        this.jobType = jobType;
        this.status = status;
        this.message = message;
        this.startedAt = startedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getCompanyId() {
        return companyId;
    }

    public IntegrationType getIntegrationType() {
        return integrationType;
    }

    public CollectionJobType getJobType() {
        return jobType;
    }

    public CollectionExecutionStatus getStatus() {
        return status;
    }

    public void setStatus(CollectionExecutionStatus status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public LocalDateTime getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(LocalDateTime finishedAt) {
        this.finishedAt = finishedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
