package naeil.dashboard.repository;

import naeil.dashboard.entity.CsInquiry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
  public interface CsInquiryRepository extends JpaRepository<CsInquiry, Long> {
        boolean existsByInqUniq(String inqUniq);
        Optional<CsInquiry> findByInqUniq(String inqUniq);
        List<CsInquiry> findByStatusOrderByCreatedAtDesc(String status);
        List<CsInquiry> findByBrandOrderByCreatedAtDesc(String brand);
        List<CsInquiry> findTop50ByOrderByCreatedAtDesc();
  }
