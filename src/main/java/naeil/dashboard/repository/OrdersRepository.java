package naeil.dashboard.repository;

import naeil.dashboard.entity.Orders;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrdersRepository extends JpaRepository<Orders, String> {
    Optional<Orders> findByUniq(String uniq);
    List<Orders> findAllByCompanyId(Long companyId);

    @Query("""
        SELECT COUNT(DISTINCT o.customerId)
        FROM Orders o
        WHERE o.companyId = :companyId
          AND (:brandId IS NULL OR o.brandId = :brandId)
          AND o.customerId IS NOT NULL
          AND o.ordStatus IN :includedStatuses
          AND COALESCE(o.ordTime, o.wdate) >= :startDateTime
          AND COALESCE(o.ordTime, o.wdate) < :endDateTime
        """)
    Long countDistinctCustomersInPeriod(
            @Param("companyId") Long companyId,
            @Param("brandId") Long brandId,
            @Param("startDateTime") LocalDateTime startDateTime,
            @Param("endDateTime") LocalDateTime endDateTime,
            @Param("includedStatuses") List<String> includedStatuses
    );
}
