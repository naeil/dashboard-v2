package naeil.dashboard.repository;

import java.util.List;
import naeil.dashboard.entity.CollectionExecutionHistory;
import naeil.dashboard.enums.IntegrationType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CollectionExecutionHistoryRepository extends JpaRepository<CollectionExecutionHistory, Long> {

    List<CollectionExecutionHistory> findByCompanyIdAndIntegrationTypeOrderByStartedAtDesc(
            Long companyId,
            IntegrationType integrationType,
            Pageable pageable
    );
}
