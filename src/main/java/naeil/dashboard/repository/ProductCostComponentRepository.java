package naeil.dashboard.repository;

import java.util.List;
import naeil.dashboard.entity.ProductCostComponent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductCostComponentRepository extends JpaRepository<ProductCostComponent, Long> {
    List<ProductCostComponent> findAllByCompanyIdAndProductIdOrderBySortOrderAscIdAsc(Long companyId, Long productId);
    List<ProductCostComponent> findAllByCompanyIdAndProductIdIn(Long companyId, List<Long> productIds);
    void deleteAllByCompanyIdAndProductId(Long companyId, Long productId);
}
