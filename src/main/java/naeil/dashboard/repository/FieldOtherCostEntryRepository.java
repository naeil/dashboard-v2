package naeil.dashboard.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import naeil.dashboard.entity.FieldOtherCostEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
  public interface FieldOtherCostEntryRepository extends JpaRepository<FieldOtherCostEntry, Long> {

List<FieldOtherCostEntry> findAllByCompanyIdOrderByEntryDateDescIdDesc(Long companyId);

List<FieldOtherCostEntry> findAllByCompanyIdAndEntryDateBetweenOrderByEntryDateDesc(
  Long companyId, LocalDate startDate, LocalDate endDate);

List<FieldOtherCostEntry> findAllByCompanyIdAndBrandIdOrderByEntryDateDesc(Long companyId, Long brandId);

Optional<FieldOtherCostEntry> findByIdAndCompanyId(Long id, Long companyId);

void deleteByIdAndCompanyId(Long id, Long companyId);
  }
