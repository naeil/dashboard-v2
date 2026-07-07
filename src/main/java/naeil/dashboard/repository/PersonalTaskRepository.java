package naeil.dashboard.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import naeil.dashboard.entity.PersonalTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
  public interface PersonalTaskRepository extends JpaRepository<PersonalTask, Long> {

List<PersonalTask> findAllByCompanyIdOrderByCategoryAscPositionAscIdDesc(Long companyId);

List<PersonalTask> findAllByCompanyIdAndBoardDateOrderByCategoryAscPositionAscIdDesc(Long companyId, LocalDate boardDate);

List<PersonalTask> findAllByCompanyIdAndCategoryNotAndBoardDateLessThan(Long companyId, String category, LocalDate boardDate);

long countByCompanyIdAndCategory(Long companyId, String category);

Optional<PersonalTask> findByIdAndCompanyId(Long id, Long companyId);

void deleteByIdAndCompanyId(Long id, Long companyId);

@Query("select distinct p.boardDate from PersonalTask p where p.companyId = :companyId and p.boardDate < :today order by p.boardDate desc")
    List<LocalDate> findDistinctPastBoardDates(@Param("companyId") Long companyId, @Param("today") LocalDate today);
  }
