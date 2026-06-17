package naeil.dashboard.repository;

import naeil.dashboard.entity.IncentiveSummary;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IncentiveSummaryRepository extends JpaRepository<IncentiveSummary, Long> {

    List<IncentiveSummary> findByIncentiveMonthOrderByEmployeeNameAsc(String incentiveMonth);

    Optional<IncentiveSummary> findByIncentiveMonthAndEmployeeName(String incentiveMonth, String employeeName);
}
