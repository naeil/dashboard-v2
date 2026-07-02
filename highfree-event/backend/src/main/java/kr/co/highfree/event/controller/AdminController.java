package kr.co.highfree.event.controller;

import kr.co.highfree.event.dto.Dtos.*;
import kr.co.highfree.event.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/summary")
    public ResponseEntity<AdminSummary> summary() {
        return ResponseEntity.ok(adminService.getSummary());
    }

    @GetMapping("/daily")
    public ResponseEntity<List<Map<String, Object>>> daily(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(adminService.getDaily(days));
    }

    @GetMapping("/breakdown")
    public ResponseEntity<List<Map<String, Object>>> breakdown() {
        return ResponseEntity.ok(adminService.getBreakdown());
    }

    @GetMapping("/qr-performance")
    public ResponseEntity<List<Map<String, Object>>> qrPerformance() {
        return ResponseEntity.ok(adminService.getQrPerformance());
    }

    @GetMapping("/suspicious")
    public ResponseEntity<List<Map<String, Object>>> suspicious() {
        return ResponseEntity.ok(adminService.getSuspicious());
    }
}
