package naeil.dashboard.repository;

import naeil.dashboard.entity.PayrollRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PayrollRecordRepository extends JpaRepository<PayrollRecord, Long> {

    List<PayrollRecord> findByCompanyIdAndPayYearMonthOrderByEmployeeName(Long companyId, String payYearMonth);

    List<PayrollRecord> findByCompanyIdOrderByPayYearMonthDescEmployeeNameAsc(Long companyId);

    @Query("SELECT DISTINCT p.payYearMonth FROM PayrollRecord p WHERE p.companyId = :companyId ORDER BY p.payYearMonth DESC")
    List<String> findDistinctMonthsByCompanyId(@Param("companyId") Long companyId);

    boolean existsByCompanyIdAndPayYearMonthAndEmployeeName(Long companyId, String payYearMonth, String employeeName);
}
