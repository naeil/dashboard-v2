package naeil.dashboard.repository;

import java.util.List;
import java.util.Optional;
import naeil.dashboard.entity.AiProviderSetting;
import naeil.dashboard.enums.AiProvider;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiProviderSettingRepository extends JpaRepository<AiProviderSetting, Long> {
    List<AiProviderSetting> findByCompanyIdOrderByProviderAsc(Long companyId);
    Optional<AiProviderSetting> findByCompanyIdAndProvider(Long companyId, AiProvider provider);
    List<AiProviderSetting> findByValidatedAtIsNotNullAndIsActiveTrueOrderByCompanyIdAscProviderAsc();
}
