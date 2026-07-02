package kr.co.highfree.event.repository;

import kr.co.highfree.event.domain.QrCode;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface QrCodeRepository extends JpaRepository<QrCode, Long> {
    Optional<QrCode> findByQrId(String qrId);
}
