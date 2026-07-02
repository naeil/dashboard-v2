package kr.co.highfree.event.repository;

import kr.co.highfree.event.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface QrCodeRepository extends JpaRepository<QrCode, Long> {
    Optional<QrCode> findByQrId(String qrId);
}

interface EventSessionRepository extends JpaRepository<EventSession, Long> {
    Optional<EventSession> findBySessionId(UUID sessionId);

    @Query(value = "SELECT ip_address, COUNT(*) as cnt FROM event_sessions GROUP BY ip_address HAVING COUNT(*) >= 3 ORDER BY cnt DESC LIMIT 50", nativeQuery = true)
    List<Object[]> findSuspiciousIps();

    @Query(value = "SELECT DATE(created_at AT TIME ZONE 'Asia/Seoul') as day, COUNT(*) as scans FROM event_sessions GROUP BY day ORDER BY day DESC LIMIT 30", nativeQuery = true)
    List<Object[]> findDailyStats();

    @Query(value = "SELECT COALESCE(q.flavor,'unknown'), COALESCE(q.country,'unknown'), COALESCE(q.channel,'unknown'), COUNT(es.id) FROM event_sessions es LEFT JOIN qr_codes q ON es.qr_code_id = q.id GROUP BY q.flavor, q.country, q.channel ORDER BY 4 DESC", nativeQuery = true)
    List<Object[]> findBreakdown();

    @Query(value = "SELECT q.qr_id, q.flavor, q.country, q.channel, COUNT(DISTINCT es.id), COUNT(DISTINCT sr.id), COUNT(DISTINCT pt.id) FROM qr_codes q LEFT JOIN event_sessions es ON q.id = es.qr_code_id LEFT JOIN spin_results sr ON es.session_id = sr.session_id LEFT JOIN point_transactions pt ON es.session_id = pt.session_id GROUP BY q.qr_id, q.flavor, q.country, q.channel ORDER BY 5 DESC", nativeQuery = true)
    List<Object[]> qrPerformance();
}

interface SpinResultRepository extends JpaRepository<SpinResult, Long> {
    Optional<SpinResult> findBySessionId(UUID sessionId);
    boolean existsBySessionId(UUID sessionId);
}

interface CustomerRepository extends JpaRepository<Customer, Long> {
    Optional<Customer> findByPhoneNumber(String phoneNumber);
}

interface PointTransactionRepository extends JpaRepository<PointTransaction, Long> {
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
