package naeil.dashboard.controller;

import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.entity.PersonalTask;
import naeil.dashboard.service.PersonalTaskService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Personal task board REST API used by the "personal task management" page
   * under executive home / CEO strategic dashboard. Additive-only controller.
   */
@RestController
  @RequestMapping("/api/personal-tasks")
  @RequiredArgsConstructor
  public class PersonalTaskController {

    private final PersonalTaskService personalTaskService;

    @GetMapping
        public ResponseEntity<List<PersonalTask>> getTasks(
                      @RequestParam(defaultValue = "1") Long companyId) {
                  return ResponseEntity.ok(personalTaskService.getTasks(companyId));
        }

    @PostMapping
        public ResponseEntity<PersonalTask> createTask(
                      @RequestParam(defaultValue = "1") Long companyId,
                      @RequestParam(required = false) String createdBy,
                      @RequestBody PersonalTask payload) {
                  return ResponseEntity.ok(personalTaskService.createTask(companyId, createdBy, payload));
        }

    @PutMapping("/{id}")
        public ResponseEntity<PersonalTask> updateTask(
                      @RequestParam(defaultValue = "1") Long companyId,
                      @PathVariable Long id,
                      @RequestBody PersonalTask payload) {
                  return ResponseEntity.ok(personalTaskService.updateContent(companyId, id, payload));
        }

    @PutMapping("/{id}/category")
        public ResponseEntity<PersonalTask> moveTask(
                      @RequestParam(defaultValue = "1") Long companyId,
                      @PathVariable Long id,
                      @RequestBody Map<String, String> payload) {
                  return ResponseEntity.ok(personalTaskService.moveTask(companyId, id, payload.get("category")));
        }

    @DeleteMapping("/{id}")
        public ResponseEntity<Map<String, String>> deleteTask(
                      @RequestParam(defaultValue = "1") Long companyId,
                      @PathVariable Long id) {
                  personalTaskService.deleteTask(companyId, id);
                  return ResponseEntity.ok(Map.of("message", "deleted"));
        }
  }
