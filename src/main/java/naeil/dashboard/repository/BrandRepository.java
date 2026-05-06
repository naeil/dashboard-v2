package naeil.dashboard.repository;

import java.util.List;
import java.util.Optional;
import naeil.dashboard.entity.Brand;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BrandRepository extends JpaRepository<Brand, Long> {
    Optional<Brand> findByCompanyIdAndBrandName(Long companyId, String brandName);
    List<Brand> findAllByCompanyIdOrderByBrandNameAsc(Long companyId);
}
