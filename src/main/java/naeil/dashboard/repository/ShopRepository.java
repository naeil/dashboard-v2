package naeil.dashboard.repository;

import naeil.dashboard.entity.Shop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShopRepository extends JpaRepository<Shop, Long> {
    Optional<Shop> findByCompanyIdAndShopCode(Long companyId, String shopCode);
    List<Shop> findAllByCompanyIdOrderByShopNameAsc(Long companyId);
}
