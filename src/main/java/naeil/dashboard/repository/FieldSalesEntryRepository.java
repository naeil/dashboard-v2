package naeil.dashboard.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import naeil.dashboard.entity.FieldSalesEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
  public interface FieldSalesEntryRepository extends JpaRepository<FieldSalesEntry, Long> {

List<FieldSalesEntry> findAllByCompanyIdOrderByEntryDateDescIdDesc(Long companyId);

List<FieldSalesEntry> findAllByCompanyIdAndEntryDateBetweenOrderByEntryDateDesc(
  Long companyId, LocalDate startDate, LocalDate endDate);

List<FieldSalesEntry> findAllByCompanyIdAndProductIdOrderByEntryDateDesc(Long companyId, Long productId);

Optional<FieldSalesEntry> findByIdAndCompanyId(Long id, Long companyId);

void deleteByIdAndCompanyId(Long id, Long companyId);
  }
