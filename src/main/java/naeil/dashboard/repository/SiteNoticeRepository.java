package naeil.dashboard.repository;

import java.util.List;
import java.util.Optional;
import naeil.dashboard.entity.SiteNotice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SiteNoticeRepository extends JpaRepository<SiteNotice, Long> {

    List<SiteNotice> findAllByCompanyIdOrderByCreatedAtDescIdDesc(Long companyId);

    Optional<SiteNotice> findByIdAndCompanyId(Long id, Long companyId);

    void deleteByIdAndCompanyId(Long id, Long companyId);
}
