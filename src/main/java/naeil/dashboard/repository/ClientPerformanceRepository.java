package naeil.dashboard.repository;

import naeil.dashboard.entity.ClientPerformance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ClientPerformanceRepository extends JpaRepository<ClientPerformance, Long> {

    List<ClientPerformance> findAllByOrderByCreatedAtDesc();

    @Query("SELECT COUNT(c) FROM ClientPerformance c WHERE c.createdAt >= :startDate AND c.createdAt < :endDate")
    Long countNewClientsByDateRange(@Param("startDate") java.time.LocalDateTime startDate, @Param("endDate") java.time.LocalDateTime endDate);

    @Query("SELECT COUNT(c) FROM ClientPerformance c WHERE c.firstOrderDate >= :startDate AND c.firstOrderDate < :endDate")
    Long countFirstOrderClientsByDateRange(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COALESCE(SUM(c.cumulativeSales), 0) FROM ClientPerformance c")
    Long sumAllCumulativeSales();
}
