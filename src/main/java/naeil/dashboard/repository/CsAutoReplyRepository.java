package naeil.dashboard.repository;

import naeil.dashboard.entity.CsAutoReply;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
  public interface CsAutoReplyRepository extends JpaRepository<CsAutoReply, Long> {
        boolean existsByInqUniq(String inqUniq);
        Optional<CsAutoReply> findByInqUniq(String inqUniq);
        List<CsAutoReply> findByStatusOrderByCreatedAtDesc(String status);
        List<CsAutoReply> findByBrandOrderByCreatedAtDesc(String brand);
        List<CsAutoReply> findTop100ByOrderByCreatedAtDesc();
        List<CsAutoReply> findByStatusIn(List<String> statuses);
        long countByStatus(String status);
        long countByDryRunFalseAndStatus(String status);
  }
