package naeil.dashboard.repository;

import naeil.dashboard.entity.AiReviewAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AiReviewAnalysisRepository extends JpaRepository<AiReviewAnalysis, Long> {

    Optional<AiReviewAnalysis> findByReviewId(Long reviewId);

    List<AiReviewAnalysis> findByReviewIdIn(List<Long> reviewIds);

    List<AiReviewAnalysis> findByIsUrgentTrue();

    List<AiReviewAnalysis> findByReplyStatus(String replyStatus);

    List<AiReviewAnalysis> findBySentiment(String sentiment);

    long countByIsUrgentTrue();

    long countBySentiment(String sentiment);
}
