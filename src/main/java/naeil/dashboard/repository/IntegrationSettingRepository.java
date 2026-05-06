package naeil.dashboard.repository;

import naeil.dashboard.entity.IntegrationSetting;
import naeil.dashboard.enums.IntegrationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IntegrationSettingRepository extends JpaRepository<IntegrationSetting, Long> {

    List<IntegrationSetting> findByCompanyId(Long companyId);

    Optional<IntegrationSetting> findByCompanyIdAndIntegrationType(Long companyId, IntegrationType type);

    List<IntegrationSetting> findByIntegrationTypeAndIsActiveTrue(IntegrationType type);

    List<IntegrationSetting> findByIntegrationTypeAndAutoCollectEnabledTrueAndIsActiveTrue(IntegrationType type);
}
