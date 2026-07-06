package naeil.dashboard.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import naeil.dashboard.entity.FieldAdCostEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
  public interface FieldAdCostEntryRepository extends JpaRepository<FieldAdCostEntry, Long> {

List<FieldAdCostEntry> findAllByCompanyIdOrderByEntryDateDescIdDesc(Long companyId);

List<FieldAdCostEntry> findAllByCompanyIdAndEntryDateBetweenOrderByEntryDateDesc(
  Long companyId, LocalDate startDate, LocalDate endDate);

List<FieldAdCostEntry> findAllByCompanyIdAndProductIdOrderByEntryDateDesc(Long companyId, Long productId);

Optional<FieldAdCostEntry> findByIdAndCompanyId(Long id, Long companyId);

void deleteByIdAndCompanyId(Long id, Long companyId);
  }
