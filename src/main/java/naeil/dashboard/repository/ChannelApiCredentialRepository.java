package naeil.dashboard.repository;

import naeil.dashboard.entity.ChannelApiCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface ChannelApiCredentialRepository extends JpaRepository<ChannelApiCredential, Long> {
    Optional<ChannelApiCredential> findByChannelType(String channelType);
    List<ChannelApiCredential> findAllByOrderByChannelTypeAsc();
}
