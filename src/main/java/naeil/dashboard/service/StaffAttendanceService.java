package naeil.dashboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class StaffAttendanceService {

    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(2))
            .build();
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final JdbcTemplate jdbcTemplate;

    public Map<String, Object> getToday(Long companyId, AuthUser user) {
        LocalDate today = LocalDate.now(SEOUL_ZONE);
        return getOrEmpty(companyId, user.username(), today);
    }

    public List<Map<String, Object>> listMonth(Long companyId, AuthUser user, LocalDate month) {
        LocalDate monthStart = (month == null ? LocalDate.now(SEOUL_ZONE) : month).withDayOfMonth(1);
        LocalDate monthEnd = monthStart.withDayOfMonth(monthStart.lengthOfMonth());
        if (UserRole.from(user.role()) == UserRole.EMPLOYEE) {
            return jdbcTemplate.queryForList("""
                    SELECT id, company_id, username, display_name, work_date,
                           clock_in_at, clock_out_at, status, created_at, updated_at
                    FROM staff_attendance_record
                    WHERE company_id = ?
                      AND LOWER(username) = LOWER(?)
                      AND work_date BETWEEN ? AND ?
                    ORDER BY work_date, username
                    """, companyId, user.username(), monthStart, monthEnd);
        }
        return jdbcTemplate.queryForList("""
                SELECT id, company_id, username, display_name, work_date,
                       clock_in_at, clock_out_at, status, created_at, updated_at
                FROM staff_attendance_record
                WHERE company_id = ?
                  AND work_date BETWEEN ? AND ?
                ORDER BY work_date, username
                """, companyId, monthStart, monthEnd);
    }

    public Map<String, Object> clock(Long companyId, AuthUser user, String action, String clientIp, String userAgent) {
        LocalDate today = LocalDate.now(SEOUL_ZONE);
        OffsetDateTime now = OffsetDateTime.now(SEOUL_ZONE);
        String normalizedAction = String.valueOf(action == null ? "IN" : action).trim().toUpperCase();
        String ipLocation = resolveIpLocation(clientIp);
        String device = classifyDevice(userAgent);
        String safeUserAgent = trimUserAgent(userAgent);

        if ("OUT".equals(normalizedAction)) {
            jdbcTemplate.update("""
                    INSERT INTO staff_attendance_record (
                        company_id, username, display_name, work_date, clock_out_at, clock_out_ip, clock_out_ip_location,
                        clock_out_device, clock_out_user_agent, status, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CLOCKED_OUT', NOW(), NOW())
                    ON CONFLICT (company_id, username, work_date)
                    DO UPDATE SET
                        clock_out_at = EXCLUDED.clock_out_at,
                        clock_out_ip = EXCLUDED.clock_out_ip,
                        clock_out_ip_location = EXCLUDED.clock_out_ip_location,
                        clock_out_device = EXCLUDED.clock_out_device,
                        clock_out_user_agent = EXCLUDED.clock_out_user_agent,
                        status = 'CLOCKED_OUT',
                        updated_at = NOW()
                    """, companyId, user.username(), user.displayName(), today, now, clientIp, ipLocation, device, safeUserAgent);
        } else {
            jdbcTemplate.update("""
                    INSERT INTO staff_attendance_record (
                        company_id, username, display_name, work_date, clock_in_at, clock_in_ip, clock_in_ip_location,
                        clock_in_device, clock_in_user_agent, status, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CLOCKED_IN', NOW(), NOW())
                    ON CONFLICT (company_id, username, work_date)
                    DO UPDATE SET
                        clock_in_at = COALESCE(staff_attendance_record.clock_in_at, EXCLUDED.clock_in_at),
                        clock_in_ip = COALESCE(staff_attendance_record.clock_in_ip, EXCLUDED.clock_in_ip),
                        clock_in_ip_location = COALESCE(staff_attendance_record.clock_in_ip_location, EXCLUDED.clock_in_ip_location),
                        clock_in_device = COALESCE(staff_attendance_record.clock_in_device, EXCLUDED.clock_in_device),
                        clock_in_user_agent = COALESCE(staff_attendance_record.clock_in_user_agent, EXCLUDED.clock_in_user_agent),
                        display_name = EXCLUDED.display_name,
                        status = CASE
                            WHEN staff_attendance_record.clock_out_at IS NOT NULL THEN 'CLOCKED_OUT'
                            ELSE 'CLOCKED_IN'
                        END,
                        updated_at = NOW()
                    """, companyId, user.username(), user.displayName(), today, now, clientIp, ipLocation, device, safeUserAgent);
        }

        return getOrEmpty(companyId, user.username(), today);
    }

    public List<Map<String, Object>> listAdminAttendance(Long companyId, AuthUser user, LocalDate month) {
        if (UserRole.from(user.role()) != UserRole.EXECUTIVE) {
            throw new CustomException(403, "대표 관리자만 출퇴근 IP 기록을 확인할 수 있습니다.");
        }
        LocalDate monthStart = (month == null ? LocalDate.now(SEOUL_ZONE) : month).withDayOfMonth(1);
        LocalDate monthEnd = monthStart.withDayOfMonth(monthStart.lengthOfMonth());
        return jdbcTemplate.queryForList("""
                SELECT id, company_id, username, display_name, work_date,
                       clock_in_at, clock_out_at, clock_in_ip, clock_out_ip,
                       clock_in_ip_location, clock_out_ip_location,
                       clock_in_device, clock_out_device, clock_in_user_agent, clock_out_user_agent,
                       status, created_at, updated_at
                FROM staff_attendance_record
                WHERE company_id = ?
                  AND work_date BETWEEN ? AND ?
                ORDER BY work_date DESC, username
                """, companyId, monthStart, monthEnd);
    }

    private Map<String, Object> getOrEmpty(Long companyId, String username, LocalDate workDate) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, company_id, username, display_name, work_date,
                       clock_in_at, clock_out_at, status, created_at, updated_at
                FROM staff_attendance_record
                WHERE company_id = ?
                  AND LOWER(username) = LOWER(?)
                  AND work_date = ?
                """, companyId, username, workDate);
        if (!rows.isEmpty()) {
            return rows.get(0);
        }
        return Map.of(
                "company_id", companyId,
                "username", username,
                "work_date", workDate,
                "status", "READY"
        );
    }

    private String resolveIpLocation(String ip) {
        if (ip == null || ip.isBlank()) {
            return null;
        }
        String normalized = ip.trim();
        if (isReservedExampleIp(normalized)) {
            return "예약/문서 예시용 IP - 실제 위치 없음";
        }
        if (isPrivateOrLocalIp(normalized)) {
            return "사내/로컬 네트워크";
        }
        try {
            String fields = "status,country,regionName,city,district,query";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("http://ip-api.com/json/" + normalized + "?fields=" + fields + "&lang=ko"))
                    .timeout(java.time.Duration.ofSeconds(3))
                    .GET()
                    .build();
            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return "위치 확인 실패";
            }
            JsonNode root = OBJECT_MAPPER.readTree(response.body());
            if (!"success".equals(root.path("status").asText())) {
                return "위치 확인 실패";
            }
            String country = root.path("country").asText("");
            String region = root.path("regionName").asText("");
            String city = root.path("city").asText("");
            String district = root.path("district").asText("");
            String location = String.join(" ", List.of(country, region, city, district)).trim().replaceAll("\\s+", " ");
            return location.isBlank() ? "위치 정보 없음" : location;
        } catch (Exception ignored) {
            return "위치 확인 실패";
        }
    }

    private boolean isPrivateOrLocalIp(String ip) {
        return ip.equals("127.0.0.1")
                || ip.equals("0:0:0:0:0:0:0:1")
                || ip.equals("::1")
                || ip.startsWith("10.")
                || ip.startsWith("192.168.")
                || ip.matches("^172\\.(1[6-9]|2[0-9]|3[0-1])\\..*")
                || ip.startsWith("169.254.");
    }

    private boolean isReservedExampleIp(String ip) {
        return ip.startsWith("192.0.2.")
                || ip.startsWith("198.51.100.")
                || ip.startsWith("203.0.113.");
    }

    private String classifyDevice(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "UNKNOWN";
        }
        String ua = userAgent.toLowerCase();
        boolean mobile = ua.contains("mobile")
                || ua.contains("android")
                || ua.contains("iphone")
                || ua.contains("ipad")
                || ua.contains("ipod")
                || ua.contains("windows phone")
                || ua.contains("blackberry")
                || ua.contains("opera mini")
                || ua.contains("tablet");
        return mobile ? "MO" : "PC";
    }

    private String trimUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return null;
        }
        String trimmed = userAgent.trim();
        return trimmed.length() <= 500 ? trimmed : trimmed.substring(0, 500);
    }
}
