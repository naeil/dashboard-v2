package naeil.dashboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import naeil.dashboard.common.config.EncryptConverter;
import naeil.dashboard.enums.AiProvider;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(
        name = "ai_provider_settings",
        uniqueConstraints = @UniqueConstraint(name = "uq_ai_provider_company_provider", columnNames = {"company_id", "provider"})
)
public class AiProviderSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 30)
    private AiProvider provider;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Convert(converter = EncryptConverter.class)
    @Column(name = "api_key", nullable = false, columnDefinition = "TEXT")
    private String apiKey;

    @Convert(converter = EncryptConverter.class)
    @Column(name = "organization_id", columnDefinition = "TEXT")
    private String organizationId;

    @Convert(converter = EncryptConverter.class)
    @Column(name = "project_id", columnDefinition = "TEXT")
    private String projectId;

    @Column(name = "validated_at")
    private LocalDateTime validatedAt;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    protected AiProviderSetting() {}

    public AiProviderSetting(Long companyId, AiProvider provider) {
        this.companyId = companyId;
        this.provider = provider;
    }

    public Long getId() { return id; }
    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }
    public AiProvider getProvider() { return provider; }
    public void setProvider(AiProvider provider) { this.provider = provider; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public LocalDateTime getValidatedAt() { return validatedAt; }
    public void setValidatedAt(LocalDateTime validatedAt) { this.validatedAt = validatedAt; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean active) { isActive = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
