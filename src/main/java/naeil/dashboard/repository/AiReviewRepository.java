package naeil.dashboard.repository;

import naeil.dashboard.entity.AiReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AiReviewRepository extends JpaRepository<AiReview, Long> {

    boolean existsByChannelAndReviewId(String channel, String reviewId);

    org.springframework.data.domain.Page<AiReview> findByBrand(String brand, org.springframework.data.domain.Pageable pageable);

    List<AiReview> findByChannelOrderByReviewDateDesc(String channel);

    List<AiReview> findByBrandOrderByReviewDateDesc(String brand);

    @Query("SELECT r FROM AiReview r ORDER BY r.reviewDate DESC")
    List<AiReview> findAllOrderByReviewDateDesc();

    @Query("SELECT r FROM AiReview r WHERE r.channel = :channel AND r.reviewId = :reviewId")
    Optional<AiReview> findByChannelAndReviewId(@Param("channel") String channel, @Param("reviewId") String reviewId);

    @Query("SELECT COUNT(r) FROM AiReview r WHERE r.brand = :brand")
    Long countByBrand(@Param("brand") String brand);

    @Query("SELECT AVG(r.rating) FROM AiReview r WHERE r.brand = :brand")
    Double avgRatingByBrand(@Param("brand") String brand);
}
