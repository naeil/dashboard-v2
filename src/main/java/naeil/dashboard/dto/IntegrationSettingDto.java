package naeil.dashboard.dto;

import java.time.LocalDateTime;
import naeil.dashboard.enums.CollectionUnit;
import naeil.dashboard.enums.IntegrationType;

public class IntegrationSettingDto {

    public static class ValidateRequest {
        private IntegrationType integrationType;
        private String apiKey;
        private String email;
        private String password;

        public IntegrationType getIntegrationType() { return integrationType; }
        public void setIntegrationType(IntegrationType integrationType) { this.integrationType = integrationType; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class SaveRequest {
        private IntegrationType integrationType;
        private String apiKey;
        private String email;
        private String password;
        private CollectionUnit collectionUnit;
        private Integer collectionValue;
        private CollectionUnit scheduleUnit;
        private Integer scheduleValue;
        private Boolean autoCollectEnabled;

        public IntegrationType getIntegrationType() { return integrationType; }
        public void setIntegrationType(IntegrationType integrationType) { this.integrationType = integrationType; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
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
    }

    public static class SaveAuthRequest {
        private IntegrationType integrationType;
        private String apiKey;
        private String email;
        private String password;

        public IntegrationType getIntegrationType() { return integrationType; }
        public void setIntegrationType(IntegrationType integrationType) { this.integrationType = integrationType; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class SaveCollectionRequest {
        private CollectionUnit collectionUnit;
        private Integer collectionValue;
        private CollectionUnit scheduleUnit;
        private Integer scheduleValue;
        private Boolean autoCollectEnabled;

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
    }

    public static class Response {
        private IntegrationType integrationType;
        private String apiKey;
        private String email;
        private String password;
        private Boolean isActive;
        private CollectionUnit collectionUnit;
        private Integer collectionValue;
        private CollectionUnit scheduleUnit;
        private Integer scheduleValue;
        private Boolean autoCollectEnabled;
        private LocalDateTime lastCollectedAt;
        private LocalDateTime lastOrderCollectedAt;
        private LocalDateTime lastInventoryCollectedAt;
        private LocalDateTime authUpdatedAt;
        private LocalDateTime collectionUpdatedAt;

        public Response(
                IntegrationType type,
                String apiKey,
                String email,
                String password,
                Boolean isActive,
                CollectionUnit collectionUnit,
                Integer collectionValue,
                CollectionUnit scheduleUnit,
                Integer scheduleValue,
                Boolean autoCollectEnabled,
                LocalDateTime lastCollectedAt,
                LocalDateTime lastOrderCollectedAt,
                LocalDateTime lastInventoryCollectedAt,
                LocalDateTime authUpdatedAt,
                LocalDateTime collectionUpdatedAt
        ) {
            this.integrationType = type;
            this.apiKey = apiKey == null ? "" : apiKey;
            this.email = email == null ? "" : email;
            this.password = password == null ? "" : password;
            this.isActive = isActive;
            this.collectionUnit = collectionUnit;
            this.collectionValue = collectionValue;
            this.scheduleUnit = scheduleUnit;
            this.scheduleValue = scheduleValue;
            this.autoCollectEnabled = autoCollectEnabled;
            this.lastCollectedAt = lastCollectedAt;
            this.lastOrderCollectedAt = lastOrderCollectedAt;
            this.lastInventoryCollectedAt = lastInventoryCollectedAt;
            this.authUpdatedAt = authUpdatedAt;
            this.collectionUpdatedAt = collectionUpdatedAt;
        }

        public IntegrationType getIntegrationType() { return integrationType; }
        public void setIntegrationType(IntegrationType integrationType) { this.integrationType = integrationType; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public Boolean getIsActive() { return isActive; }
        public void setIsActive(Boolean isActive) { this.isActive = isActive; }
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
    }
}
