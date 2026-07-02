package kr.co.highfree.event.service;

import kr.co.highfree.event.dto.Dtos.*;
import kr.co.highfree.event.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminService {

    private final EventSessionRepository sessionRepo;
    private final SpinResultRepository spinResultRepo;
    private final CustomerRepository customerRepo;
    private final PointTransactionRepository ptRepo;

    public AdminSummary getSummary() {
        long scans = sessionRepo.count();
        long spins = spinResultRepo.count();
        long claims = ptRepo.totalPointsEarned() != null ? customerRepo.count() : 0;
        long customers = customerRepo.count();
        Long totalPoints = ptRepo.totalPointsEarned();
        double conversion = scans > 0 ? (double) customers / scans * 100 : 0;

        return AdminSummary.builder()
                .totalScans(scans)
                .totalSpins(spins)
                .totalClaims(customers)
                .conversionRate(Math.round(conversion * 100.0) / 100.0)
                .totalPointsEarned(totalPoints != null ? totalPoints : 0)
                .build();
    }

    public List<Map<String, Object>> getDaily(int days) {
        OffsetDateTime from = OffsetDateTime.now().minusDays(days);
        List<Object[]> scanRows = sessionRepo.dailyScans(from);
        List<Object[]> claimRows = ptRepo.dailyClaims(from);

        Map<String, Long> claimMap = new HashMap<>();
        Map<String, Long> pointMap = new HashMap<>();
        for (Object[] row : claimRows) {
            String day = row[0].toString();
            claimMap.put(day, ((Number) row[1]).longValue());
            pointMap.put(day, ((Number) row[2]).longValue());
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
}
