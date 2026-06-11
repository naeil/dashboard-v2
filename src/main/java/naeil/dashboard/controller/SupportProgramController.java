package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.SupportProgramDTO;
import naeil.dashboard.service.SupportProgramService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/support-programs")
@RequiredArgsConstructor
public class SupportProgramController {
    private final SupportProgramService service;

    @GetMapping
    public ResponseEntity<List<SupportProgramDTO>> list(@RequestParam Long companyId) {
        return ResponseEntity.ok(service.findAll(companyId));
    }

    @GetMapping("/kpi")
    public ResponseEntity<Map<String, Object>> kpi(@RequestParam Long companyId) {
        return ResponseEntity.ok(service.getKpi(companyId));
    }

    @PostMapping
    public ResponseEntity<SupportProgramDTO> create(@RequestBody SupportProgramDTO dto) {
        return ResponseEntity.ok(service.create(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> update(@PathVariable Long id, @RequestBody SupportProgramDTO dto) {
        service.update(id, dto);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.ok().build();
    }
}
