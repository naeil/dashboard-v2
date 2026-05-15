package naeil.dashboard.repository;

import naeil.dashboard.entity.BrandKeywordSearchLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BrandKeywordSearchLogRepository extends JpaRepository<BrandKeywordSearchLog, Long> {
}
