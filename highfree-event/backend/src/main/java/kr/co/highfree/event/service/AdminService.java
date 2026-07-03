package kr.co.highfree.event.service;

import kr.co.highfree.event.dto.Dtos.*;
import kr.co.highfree.event.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class AdminService {

    private final EventSessionRepository sessionRepo;
    private final SpinResultRepository spinResultRepo;
    private final CustomerRepository customerRepo;
    private final PointTransactionRepository ptRepo;

    public AdminService(EventSessionRepository sessionRepo, SpinResultRepository spinResultRepo,
                        CustomerRepository customerRepo, PointTransactionRepository ptRepo) {
        this.sessionRepo = sessionRepo;
        this.spinResultRepo = spinResultRepo;
        this.customerRepo = customerRepo;
        this.ptRepo = ptRepo;
    }

    public AdminSummary getSummary() {
        long scans = sessionRepo.count();
        long spins = spinResultRepo.count();
        long claims = ptRepo.totalPointsEarned() != null ? customerRepo.count() : 0;
        long customers = customerRepo.count();
        long totalPoints = ptRepo.totalPointsEarned() != null ? ptRepo.totalPointsEarned() : 0;
        double conversion = scans > 0 ? (double) customers / scans * 100 : 0;

        return AdminSummary.builder()
            .totalScans(scans)
            .totalSpins(spins)
            .totalClaims(customers)
            .conversionRate(Math.round(conversion * 100.0) / 100.0)
            .totalPointsEarned(totalPoints)
            .build();
    }

    public List<Map<String, Object>> getDaily() {
        List<Object[]> scanRows = sessionRepo.findDailyStats();
        List<Object[]> claimRows = ptRepo.findDailyStats();
        List<Object[]> pointRows = ptRepo.findDailyPoints();

        Map<String, Long> claimMap = new LinkedHashMap<>();
        for (Object[] row : claimRows) {
            claimMap.put(row[0].toString(), ((Number) row[1]).longValue());
        }
        Map<String, Long> pointMap = new LinkedHashMap<>();
        for (Object[] row : pointRows) {
            pointMap.put(row[0].toString(), ((Number) row[1]).longValue());
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : scanRows) {
            String day = row[0].toString();
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("date", day);
            item.put("scans", ((Number) row[1]).longValue());
            item.put("claims", claimMap.getOrDefault(day, 0L));
            item.put("points", pointMap.getOrDefault(day, 0L));
            result.add(item);
        }
        return result;
    }

    public List<Map<String, Object>> getBreakdown() {
        List<Object[]> rows = sessionRepo.findBreakdown();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("flavor", row[0]);
            item.put("country", row[1]);
            item.put("channel", row[2]);
            item.put("count", ((Number) row[3]).longValue());
            result.add(item);
        }
        return result;
    }

    public List<Map<String, Object>> getQrPerformance() {
        List<Object[]> rows = sessionRepo.qrPerformance();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("qrId", row[0]);
            item.put("flavor", row[1]);
            item.put("country", row[2]);
            item.put("channel", row[3]);
            item.put("scans", ((Number) row[4]).longValue());
            item.put("spins", ((Number) row[5]).longValue());
            item.put("claims", ((Number) row[6]).longValue());
            long scans = ((Number) row[4]).longValue();
            long claims = ((Number) row[6]).longValue();
            item.put("conversionRate", scans > 0 ? Math.round((double) claims / scans * 10000.0) / 100.0 : 0);
            result.add(item);
        }
        return result;
    }

    public List<Map<String, Object>> getSuspicious() {
        List<Object[]> rows = sessionRepo.findSuspiciousIps();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ip", row[0]);
            item.put("count", ((Number) row[1]).longValue());
            result.add(item);
        }
        return result;
    }

        public List<Map<String, Object>> getParticipants() {
                    List<Object[]> rows = customerRepo.findAllParticipants();
                    List<Map<String, Object>> result = new ArrayList<>();
                    for (Object[] row : rows) {
                                    Map<String, Object> item = new LinkedHashMap<>();
                                    item.put("id", row[0]);
                                    item.put("phoneNumber", row[1]);
                                    item.put("points", row[2]);
                                    item.put("couponCode", row[3]);
                                    item.put("marketingAgree", row[4]);
                                    item.put("joinedAt", row[5] != null ? row[5].toString() : null);
                                    result.add(item);
                    }
                    return result;
        }
}
}
