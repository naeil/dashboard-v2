package naeil.dashboard.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import naeil.dashboard.entity.FieldInventoryOrderEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
  public interface FieldInventoryOrderEntryRepository extends JpaRepository<FieldInventoryOrderEntry, Long> {

List<FieldInventoryOrderEntry> findAllByCompanyIdOrderByEntryDateDescIdDesc(Long companyId);

List<FieldInventoryOrderEntry> findAllByCompanyIdAndEntryDateBetweenOrderByEntryDateDesc(
  Long companyId, LocalDate startDate, LocalDate endDate);

List<FieldInventoryOrderEntry> findAllByCompanyIdAndProductIdOrderByEntryDateDesc(Long companyId, Long productId);

Optional<FieldInventoryOrderEntry> findByIdAndCompanyId(Long id, Long companyId);

void deleteByIdAndCompanyId(Long id, Long companyId);
  }
