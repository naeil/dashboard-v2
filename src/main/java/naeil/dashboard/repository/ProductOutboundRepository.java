package naeil.dashboard.repository;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import naeil.dashboard.entity.ProductOutbound;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductOutboundRepository extends JpaRepository<ProductOutbound, Long> {

    Optional<ProductOutbound> findByCompanyIdAndProductIdAndOutboundDate(Long companyId, Long productId, LocalDate outboundDate);

    Optional<ProductOutbound> findTopByCompanyIdAndProductIdAndOutboundDateBeforeOrderByOutboundDateDesc(
            Long companyId,
            Long productId,
            LocalDate outboundDate
    );

    @Query("""
        SELECT COALESCE(SUM(p.outboundCount), 0)
        FROM ProductOutbound p
        WHERE p.companyId = :companyId
          AND p.productId = :productId
          AND function('to_char', p.outboundDate, 'YYYY-MM') = :yearMonth
        """)
    Integer sumMonthlyOutboundByProduct(
            @Param("companyId") Long companyId,
            @Param("productId") Long productId,
            @Param("yearMonth") String yearMonth
    );

    @Query("""
        SELECT p.productId, COALESCE(SUM(p.outboundCount), 0)
        FROM ProductOutbound p
        WHERE p.companyId = :companyId
          AND function('to_char', p.outboundDate, 'YYYY-MM') = :yearMonth
        GROUP BY p.productId
        """)
    List<Object[]> sumMonthlyOutboundByCompany(
            @Param("companyId") Long companyId,
            @Param("yearMonth") String yearMonth
    );

}
