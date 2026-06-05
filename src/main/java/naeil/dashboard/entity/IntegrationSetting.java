package naeil.dashboard.entity;

import jakarta.persistence.*;
import naeil.dashboard.common.config.EncryptConverter;
import naeil.dashboard.enums.CollectionUnit;
import naeil.dashboard.enums.IntegrationType;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "integration_settings")
public class IntegrationSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "integration_type", nullable = false, length = 50)
    private IntegrationType integrationType;

    @Convert(converter = EncryptConverter.class)
    @Column(name = "api_key", columnDefinition = "TEXT")
    private String apiKey;

    @Convert(converter = EncryptConverter.class)
    @Column(name = "access_token", columnDefinition = "TEXT")
    private String accessToken;

    @Column(name = "token_expires_at")
    private LocalDateTime tokenExpiresAt;

    @Convert(converter = EncryptConverter.class)
    @Column(name = "api_email", columnDefinition = "TEXT")
    private String apiEmail;

    @Convert(converter = EncryptConverter.class)
    @Column(name = "api_password", columnDefinition = "TEXT")
    private String apiPassword;

    @Convert(converter = EncryptConverter.class)
    @Column(name = "api_extra", columnDefinition = "TEXT")
    private String apiExtra;

    @Enumerated(EnumType.STRING)
    @Column(name = "collection_unit", length = 20)
    private CollectionUnit collectionUnit;

    @Column(name = "collection_value")
    private Integer collectionValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_unit", length = 20)
    private CollectionUnit scheduleUnit;

    @Column(name = "schedule_value")
    private Integer scheduleValue;

    @Column(name = "auto_collect_enabled")
    private Boolean autoCollectEnabled = false;

    @Column(name = "last_collected_at")
    private LocalDateTime lastCollectedAt;

    @Column(name = "last_order_collected_at")
    private LocalDateTime lastOrderCollectedAt;

    @Column(name = "last_inventory_collected_at")
    private LocalDateTime lastInventoryCollectedAt;

    @Column(name = "auth_updated_at")
    private LocalDateTime authUpdatedAt;

    @Column(name = "collection_updated_at")
    private LocalDateTime collectionUpdatedAt;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    // Default constructor
    protected IntegrationSetting() {}
    
    public IntegrationSetting(Long companyId, IntegrationType type) {
        this.companyId = companyId;
        this.integrationType = type;
        this.isActive = true;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getCompanyId() { return companyId; }
    public void setCompanyId(Long companyId) { this.companyId = companyId; }
    public IntegrationType getIntegrationType() { return integrationType; }
    public void setIntegrationType(IntegrationType integrationType) { this.integrationType = integrationType; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }
    public LocalDateTime getTokenExpiresAt() { return tokenExpiresAt; }
    public void setTokenExpiresAt(LocalDateTime tokenExpiresAt) { this.tokenExpiresAt = tokenExpiresAt; }
    public String getApiEmail() { return apiEmail; }
    public void setApiEmail(String apiEmail) { this.apiEmail = apiEmail; }
    public String getApiPassword() { return apiPassword; }
    public void setApiPassword(String apiPassword) { this.apiPassword = apiPassword; }
    public String getApiExtra() { return apiExtra; }
    public void setApiExtra(String apiExtra) { this.apiExtra = apiExtra; }
    public CollectionUnit getCollectionUnit() { return collectionUnit; }
    public void setCollectionUnit(CollectionUnit collectionUnit) { this.collectionUnit = collectionUnit; }
    public Integer getCollectionValue() { return collectionValue; }
    public void setCollectionValue(Integer collectionValue) { this.collectionValue = collectionValue; }
    public CollectionUnit getScheduleUnit() { return scheduleUnit; }
    public void setScheduleUnit(CollectionUnit scheduleUnit) { this.scheduleUnit = scheduleUnit; }
    public Integer getScheduleValue() { return scheduleValue; }
    public void setScheduleValue(Integer scheduleValue) { this.scheduleValue = scheduleValue; }
    public Boolean getAutoCollectEnabled() { return autoCollectEnabled; }
    public void setAutoCollectEnabled(Boolean autoCollectEnabled) { this.autoCollectEnabled = autoCollectEnabled; }
    public LocalDateTime getLastCollectedAt() { return lastCollectedAt; }
    public void setLastCollectedAt(LocalDateTime lastCollectedAt) { this.lastCollectedAt = lastCollectedAt; }
    public LocalDateTime getLastOrderCollectedAt() { return lastOrderCollectedAt; }
    public void setLastOrderCollectedAt(LocalDateTime lastOrderCollectedAt) { this.lastOrderCollectedAt = lastOrderCollectedAt; }
    public LocalDateTime getLastInventoryCollectedAt() { return lastInventoryCollectedAt; }
    public void setLastInventoryCollectedAt(LocalDateTime lastInventoryCollectedAt) { this.lastInventoryCollectedAt = lastInventoryCollectedAt; }
    public LocalDateTime getAuthUpdatedAt() { return authUpdatedAt; }
    public void setAuthUpdatedAt(LocalDateTime authUpdatedAt) { this.authUpdatedAt = authUpdatedAt; }
    public LocalDateTime getCollectionUpdatedAt() { return collectionUpdatedAt; }
    public void setCollectionUpdatedAt(LocalDateTime collectionUpdatedAt) { this.collectionUpdatedAt = collectionUpdatedAt; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
