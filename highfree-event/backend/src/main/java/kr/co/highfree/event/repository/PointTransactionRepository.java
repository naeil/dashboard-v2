package kr.co.highfree.event.repository;

import kr.co.highfree.event.domain.PointTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;

public interface PointTransactionRepository extends JpaRepository<PointTransaction, Long> {
    @Query(value = "SELECT COALESCE(SUM(points),0) FROM point_transactions WHERE customer_id = :customerId AND tx_type = 'EARN'", nativeQuery = true)
    long sumPointsByCustomer(@Param("customerId") Long customerId);

    @Query(value = "SELECT COUNT(*) > 0 FROM point_transactions pt JOIN customers c ON pt.customer_id = c.id WHERE c.phone_number = :phone AND DATE(pt.created_at AT TIME ZONE 'Asia/Seoul') = :today AND pt.tx_type = 'EARN'", nativeQuery = true)
    boolean existsByPhoneNumberAndDate(@Param("phone") String phoneNumber, @Param("today") LocalDate today);

    @Query(value = "SELECT DATE(created_at AT TIME ZONE 'Asia/Seoul') as day, COUNT(*) as claims, COALESCE(SUM(points),0) as points FROM point_transactions WHERE tx_type='EARN' GROUP BY day ORDER BY day DESC LIMIT 30", nativeQuery = true)
    List<Object[]> findDailyStats();

    @Query(value = "SELECT DATE(created_at AT TIME ZONE 'Asia/Seoul') as day, COALESCE(SUM(points),0) as points FROM point_transactions WHERE tx_type='EARN' GROUP BY day ORDER BY day DESC LIMIT 30", nativeQuery = true)
    List<Object[]> findDailyPoints();

    @Query(value = "SELECT COALESCE(SUM(points),0) FROM point_transactions WHERE tx_type='EARN'", nativeQuery = true)
    Long totalPointsEarned();
}
