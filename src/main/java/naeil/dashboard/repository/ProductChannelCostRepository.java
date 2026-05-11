package naeil.dashboard.repository;

import java.util.List;
import java.util.Optional;
import naeil.dashboard.entity.ProductChannelCost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductChannelCostRepository extends JpaRepository<ProductChannelCost, Long> {
    List<ProductChannelCost> findAllByCompanyIdAndProductIdOrderByShopIdAsc(Long companyId, Long productId);
    List<ProductChannelCost> findAllByCompanyIdAndProductIdIn(Long companyId, List<Long> productIds);
    Optional<ProductChannelCost> findByCompanyIdAndProductIdAndShopId(Long companyId, Long productId, Long shopId);
}
