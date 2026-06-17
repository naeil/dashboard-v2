package naeil.dashboard.repository;

import naeil.dashboard.entity.ClientPerformance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClientPerformanceRepository extends JpaRepository<ClientPerformance, Long> {

    List<ClientPerformance> findAllByOrderByCreatedAtDesc();

    @Query("SELECT COUNT(c) FROM ClientPerformance c WHERE FUNCTION('TO_CHAR', c.createdAt, 'YYYY-MM') = :month")
    Long countNewClientsByMonth(@Param("month") String month);

    @Query("SELECT COUNT(c) FROM ClientPerformance c WHERE c.firstOrderDate IS NOT NULL AND FUNCTION('TO_CHAR', c.firstOrderDate, 'YYYY-MM') = :month")
    Long countFirstOrderClientsByMonth(@Param("month") String month);

    @Query("SELECT COALESCE(SUM(c.cumulativeSales), 0) FROM ClientPerformance c")
    Long sumAllCumulativeSales();
}
