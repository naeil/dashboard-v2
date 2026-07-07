package naeil.dashboard.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.entity.PersonalTask;
import naeil.dashboard.repository.PersonalTaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Personal task board service: Inbox / today (max 5) / waiting / done.
   * Purely additive, does not modify any existing service.
   */
@Service
  @RequiredArgsConstructor
  @Transactional
  public class PersonalTaskService {

    private static final int TODAY_LIMIT = 5;
        private static final Set<String> ALLOWED_CATEGORIES = Set.of("INBOX", "TODAY", "WAITING", "DONE");

    private final PersonalTaskRepository personalTaskRepository;

    public List<PersonalTask> getTasks(Long companyId) {
              return personalTaskRepository.findAllByCompanyIdOrderByCategoryAscPositionAscIdDesc(companyId);
    }

    public PersonalTask createTask(Long companyId, String createdBy, PersonalTask payload) {
              String category = normalizeCategory(payload.getCategory());
              if ("TODAY".equals(category)) {
                            ensureTodayCapacity(companyId);
              }
              payload.setCompanyId(companyId);
              payload.setCategory(category);
              payload.setCreatedBy(createdBy);
              payload.setDoneAt("DONE".equals(category) ? LocalDateTime.now() : null);
              return personalTaskRepository.save(payload);
    }

    public PersonalTask updateContent(Long companyId, Long id, PersonalTask payload) {
              PersonalTask existing = getOwnedTask(companyId, id);
              existing.setContent(payload.getContent());
              existing.setMemo(payload.getMemo());
              return personalTaskRepository.save(existing);
    }

    public PersonalTask moveTask(Long companyId, Long id, String rawCategory) {
              String targetCategory = normalizeCategory(rawCategory);
              PersonalTask existing = getOwnedTask(companyId, id);

            if (!existing.getCategory().equals(targetCategory) && "TODAY".equals(targetCategory)) {
                          ensureTodayCapacity(companyId);
            }

            existing.setCategory(targetCategory);
              existing.setDoneAt("DONE".equals(targetCategory) ? LocalDateTime.now() : null);
              return personalTaskRepository.save(existing);
    }

    public void deleteTask(Long companyId, Long id) {
              personalTaskRepository.deleteByIdAndCompanyId(id, companyId);
    }

    private PersonalTask getOwnedTask(Long companyId, Long id) {
              return personalTaskRepository.findByIdAndCompanyId(id, companyId)
                                .orElseThrow(() -> new CustomException(404, "Task not found: " + id));
    }

    private void ensureTodayCapacity(Long companyId) {
              long todayCount = personalTaskRepository.countByCompanyIdAndCategory(companyId, "TODAY");
              if (todayCount >= TODAY_LIMIT) {
                            throw new CustomException(400, "Today tasks are limited to " + TODAY_LIMIT + " items.");
              }
    }

    private String normalizeCategory(String category) {
              String normalized = category == null ? "INBOX" : category.trim().toUpperCase();
              if (!ALLOWED_CATEGORIES.contains(normalized)) {
                            throw new CustomException(400, "Invalid category: " + category);
              }
              return normalized;
    }
  }
