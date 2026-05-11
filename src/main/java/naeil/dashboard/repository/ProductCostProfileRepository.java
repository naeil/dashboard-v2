package naeil.dashboard.repository;

import java.util.Optional;
import naeil.dashboard.entity.ProductCostProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductCostProfileRepository extends JpaRepository<ProductCostProfile, Long> {
    Optional<ProductCostProfile> findByCompanyIdAndProductId(Long companyId, Long productId);
}
