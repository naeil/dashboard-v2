package naeil.dashboard.repository;

import java.util.Optional;
import naeil.dashboard.entity.SiteLoginBanner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SiteLoginBannerRepository extends JpaRepository<SiteLoginBanner, Long> {

    Optional<SiteLoginBanner> findByCompanyId(Long companyId);
}
