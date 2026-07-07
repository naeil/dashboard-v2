package naeil.dashboard.repository;

import java.util.List;
import java.util.Optional;
import naeil.dashboard.entity.PersonalTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
  public interface PersonalTaskRepository extends JpaRepository<PersonalTask, Long> {

    List<PersonalTask> findAllByCompanyIdOrderByCategoryAscPositionAscIdDesc(Long companyId);

    long countByCompanyIdAndCategory(Long companyId, String category);

    Optional<PersonalTask> findByIdAndCompanyId(Long id, Long companyId);

    void deleteByIdAndCompanyId(Long id, Long companyId);
  }
