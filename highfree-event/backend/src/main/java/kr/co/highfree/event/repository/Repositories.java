package kr.co.highfree.event.repository;

import kr.co.highfree.event.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Repository
interface EventSessionRepository extends JpaRepository<EventSession, Long> {
    Optional<EventSession> findBySessionId(UUID sessionId);
    long countByIpAddressAndCreatedAtBetween(String ip, OffsetDateTime start, OffsetDateTime end);
    
    @Query(value = "SELECT ip_address, COUNT(*) as cnt FROM event_sessions WHERE created_at > NOW() - INTERVAL '1 day' GROUP BY ip_address HAVING COUNT(*) >= 3 ORDER BY cnt DESC LIMIT 50", nativeQuery = true)
    List<Object[]> findSuspiciousIps();
    
    @Query(value = "SELECT DATE(created_at AT TIME ZONE 'Asia/Seoul') as day, COUNT(*) as scans FROM event_sessions WHERE created_at >= :from GROUP BY day ORDER BY day", nativeQuery = true)
    List<Object[]> dailyScans(@Param("from") OffsetDateTime from);
    
    @Query(value = "SELECT COALESCE(q.flavor, 'unknown') as flavor, COALESCE(q.country, 'unknown') as country, COALESCE(q.channel, 'unknown') as channel, COUNT(es.id) as cnt FROM event_sessions es LEFT JOIN qr_codes q ON es.qr_code_id = q.id GROUP BY q.flavor, q.country, q.channel ORDER BY cnt DESC", nativeQuery = true)
    List<Object[]> findBreakdown();
    
    @Query(value = "SELECT q.qr_id, q.flavor, q.country, q.channel, COUNT(es.id) as scans, COUNT(sr.id) as spins, COUNT(pt.id) as claims FROM qr_codes q LEFT JOIN event_sessions es ON q.id = es.qr_code_id LEFT JOIN spin_results sr ON es.session_id = sr.session_id LEFT JOIN point_transactions pt ON es.session_id = pt.session_id GROUP BY q.qr_id, q.flavor, q.country, q.channel ORDER BY scans DESC", nativeQuery = true)
    List<Object[]> qrPerformance();
}

@Repository
interface SpinResultRepository extends JpaRepository<SpinResult, Long> {
    Optional<SpinResult> findBySessionId(UUID sessionId);
    boolean existsBySessionId(UUID sessionId);
}

@Repository
interface CustomerRepository extends JpaRepository<Customer, Long> {
    Optional<Customer> findByPhoneNumber(String phoneNumber);
}

@Repository
interface PointTransactionRepository extends JpaRepository<PointTransaction, Long> {
    @Query("SELECT SUM(pt.point) FROM PointTransaction pt WHERE pt.customerId = :customerId AND pt.type = 'EARN'")
    Optional<Integer> sumEarnByCustomerId(@Param("customerId") Long customerId);
    
    @Query(value = "SELECT COUNT(*) > 0 FROM point_transactions pt JOIN event_sessions es ON pt.session_id = es.session_id WHERE pt.customer_id = :customerId AND DATE(pt.created_at AT TIME ZONE 'Asia/Seoul') = CURRENT_DATE AND pt.type = 'EARN'", nativeQuery = true)
    boolean existsTodayEarnByCustomer(@Param("customerId") Long customerId);
    
    @Query(value = "SELECT DATE(created_at AT TIME ZONE 'Asia/Seoul') as day, COUNT(*) as claims, COALESCE(SUM(point),0) as points FROM point_transactions WHERE type='EARN' AND created_at >= :from GROUP BY day ORDER BY day", nativeQuery = true)
    List<Object[]> dailyClaims(@Param("from") OffsetDateTime from);
    
    @Query(value = "SELECT COALESCE(SUM(point),0) FROM point_transactions WHERE type='EARN'", nativeQuery = true)
    Long totalPointsEarned();
}
