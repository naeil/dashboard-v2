package kr.co.highfree.event.controller;

import kr.co.highfree.event.service.AdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/summary")
    public ResponseEntity<?> getSummary() {
        return ResponseEntity.ok(adminService.getSummary());
    }

    @GetMapping("/daily")
    public ResponseEntity<List<Map<String, Object>>> getDaily() {
        return ResponseEntity.ok(adminService.getDaily());
    }

    @GetMapping("/breakdown")
    public ResponseEntity<List<Map<String, Object>>> getBreakdown() {
        return ResponseEntity.ok(adminService.getBreakdown());
    }

    @GetMapping("/qr-performance")
    public ResponseEntity<List<Map<String, Object>>> getQrPerformance() {
        return ResponseEntity.ok(adminService.getQrPerformance());
    }

    @GetMapping("/suspicious")
    public ResponseEntity<List<Map<String, Object>>> getSuspicious() {
        return ResponseEntity.ok(adminService.getSuspicious());
    }
}
