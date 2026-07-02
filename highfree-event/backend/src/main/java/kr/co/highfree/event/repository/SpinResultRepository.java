package kr.co.highfree.event.repository;

import kr.co.highfree.event.domain.SpinResult;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface SpinResultRepository extends JpaRepository<SpinResult, Long> {
    Optional<SpinResult> findBySessionId(UUID sessionId);
    boolean existsBySessionId(UUID sessionId);
}
