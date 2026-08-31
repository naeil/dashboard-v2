package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
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
 * 내 업무 메모 — 개인 전용(본인 것만 조회/수정). 주간 캘린더 메모 + 자유 메모장.
 */
@RestController
@RequestMapping("/api/personal-memo")
@RequiredArgsConstructor
public class PersonalMemoController {

    private static final Long COMPANY = 1L;
    private final JdbcTemplate jdbcTemplate;
    private final naeil.dashboard.service.GoogleCalendarService googleCalendarService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(
            @RequestParam String from, @RequestParam String to, HttpServletRequest request) {
        AuthUser user = user(request);
        return ResponseEntity.ok(jdbcTemplate.queryForList("""
                SELECT id, memo_date, start_time, end_time, content, is_done
                FROM personal_task_memo
                WHERE company_id = ? AND LOWER(username) = LOWER(?) AND memo_date BETWEEN ? AND ?
                ORDER BY memo_date, start_time NULLS FIRST, id
                """, COMPANY, user.username(), java.sql.Date.valueOf(LocalDate.parse(from)),
                java.sql.Date.valueOf(LocalDate.parse(to))));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> p, HttpServletRequest request) {
        AuthUser user = user(request);
        String content = str(p.get("content"));
        if (content == null) return ResponseEntity.ok(Map.of("success", false, "message", "내용을 입력하세요."));
        LocalDate date;
        try {
            date = LocalDate.parse(String.valueOf(p.get("date")).substring(0, 10));
        } catch (Exception e) {
            date = LocalDate.now();
        }
        jdbcTemplate.update("""
                INSERT INTO personal_task_memo (company_id, username, memo_date, start_time, end_time, content)
                VALUES (?, ?, ?, ?, ?, ?)
                """, COMPANY, user.username(), java.sql.Date.valueOf(date),
                time(p.get("startTime")), time(p.get("endTime")),
                content.substring(0, Math.min(content.length(), 500)));
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> update(
            @PathVariable Long id, @RequestBody Map<String, Object> p, HttpServletRequest request) {
        AuthUser user = user(request);
        StringBuilder sql = new StringBuilder("UPDATE personal_task_memo SET updated_at = NOW()");
        java.util.List<Object> params = new java.util.ArrayList<>();
        if (p.containsKey("content")) {
            String content = str(p.get("content"));
            if (content == null) return ResponseEntity.ok(Map.of("success", false, "message", "내용을 입력하세요."));
            sql.append(", content = ?");
            params.add(content.substring(0, Math.min(content.length(), 500)));
        }
        if (p.containsKey("isDone")) { sql.append(", is_done = ?"); params.add(Boolean.TRUE.equals(p.get("isDone"))); }
        if (p.containsKey("date")) {
            try {
                sql.append(", memo_date = ?");
                params.add(java.sql.Date.valueOf(LocalDate.parse(String.valueOf(p.get("date")).substring(0, 10))));
            } catch (Exception ignored) {
                return ResponseEntity.ok(Map.of("success", false, "message", "날짜 형식 오류"));
            }
        }
        if (p.containsKey("startTime")) { sql.append(", start_time = ?"); params.add(time(p.get("startTime"))); }
        if (p.containsKey("endTime")) { sql.append(", end_time = ?"); params.add(time(p.get("endTime"))); }
        if (params.isEmpty()) return ResponseEntity.ok(Map.of("success", false, "message", "변경할 값이 없습니다."));
        sql.append(" WHERE id = ? AND company_id = ? AND LOWER(username) = LOWER(?)");
        params.add(id);
        params.add(COMPANY);
        params.add(user.username());
        int updated = jdbcTemplate.update(sql.toString(), params.toArray());
        return ResponseEntity.ok(updated > 0 ? Map.of("success", true)
                : Map.of("success", false, "message", "본인 메모만 수정할 수 있습니다."));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable Long id, HttpServletRequest request) {
        AuthUser user = user(request);
        int deleted = jdbcTemplate.update(
                "DELETE FROM personal_task_memo WHERE id = ? AND company_id = ? AND LOWER(username) = LOWER(?)",
                id, COMPANY, user.username());
        return ResponseEntity.ok(deleted > 0 ? Map.of("success", true)
                : Map.of("success", false, "message", "본인 메모만 삭제할 수 있습니다."));
    }

    /* ── 자유 메모장 (사용자당 1개, 자동 저장) ── */

    @GetMapping("/note")
    public ResponseEntity<Map<String, Object>> getNote(HttpServletRequest request) {
        AuthUser user = user(request);
        String content = jdbcTemplate.query(
                "SELECT content FROM personal_note WHERE company_id = ? AND LOWER(username) = LOWER(?)",
                rs -> rs.next() ? rs.getString(1) : null, COMPANY, user.username());
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("content", content == null ? "" : content);
        return ResponseEntity.ok(body);
    }

    @PutMapping("/note")
    public ResponseEntity<Map<String, Object>> saveNote(@RequestBody Map<String, Object> p, HttpServletRequest request) {
        AuthUser user = user(request);
        String content = p.get("content") == null ? "" : String.valueOf(p.get("content"));
        if (content.length() > 20_000) content = content.substring(0, 20_000);
        jdbcTemplate.update("""
                INSERT INTO personal_note (company_id, username, content, updated_at)
                VALUES (?, ?, ?, NOW())
                ON CONFLICT (company_id, username) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
                """, COMPANY, user.username(), content);
        return ResponseEntity.ok(Map.of("success", true));
    }

    /* ── 구글 캘린더 연동 (비공개 iCal 주소) ── */

    @GetMapping("/gcal-link")
    public ResponseEntity<Map<String, Object>> getGcalLink(HttpServletRequest request) {
        AuthUser user = user(request);
        String url = jdbcTemplate.query(
                "SELECT ics_url FROM personal_gcal_link WHERE company_id = ? AND LOWER(username) = LOWER(?)",
                rs -> rs.next() ? rs.getString(1) : null, COMPANY, user.username());
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("linked", url != null);
        return ResponseEntity.ok(body);
    }

    @PutMapping("/gcal-link")
    public ResponseEntity<Map<String, Object>> saveGcalLink(@RequestBody Map<String, Object> p, HttpServletRequest request) {
        AuthUser user = user(request);
        String url = p.get("icsUrl") == null ? null : String.valueOf(p.get("icsUrl")).trim();
        if (!naeil.dashboard.service.GoogleCalendarService.isValidIcsUrl(url)) {
            return ResponseEntity.ok(Map.of("success", false,
                    "message", "구글 캘린더의 비공개 iCal 주소(https://calendar.google.com/.../basic.ics)를 붙여넣어 주세요."));
        }
        // 등록 전에 실제로 읽히는지 1회 검증
        try {
            googleCalendarService.events(url, LocalDate.now().minusDays(7), LocalDate.now().plusDays(7));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false,
                    "message", "캘린더를 읽지 못했습니다. 주소를 다시 복사해 주세요. (설정 > 캘린더의 비공개 주소 iCal 형식)"));
        }
        jdbcTemplate.update("""
                INSERT INTO personal_gcal_link (company_id, username, ics_url, updated_at)
                VALUES (?, ?, ?, NOW())
                ON CONFLICT (company_id, username) DO UPDATE SET ics_url = EXCLUDED.ics_url, updated_at = NOW()
                """, COMPANY, user.username(), url);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @DeleteMapping("/gcal-link")
    public ResponseEntity<Map<String, Object>> deleteGcalLink(HttpServletRequest request) {
        AuthUser user = user(request);
        jdbcTemplate.update(
                "DELETE FROM personal_gcal_link WHERE company_id = ? AND LOWER(username) = LOWER(?)",
                COMPANY, user.username());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/gcal")
    public ResponseEntity<Map<String, Object>> gcalEvents(
            @RequestParam String from, @RequestParam String to, HttpServletRequest request) {
        AuthUser user = user(request);
        String url = jdbcTemplate.query(
                "SELECT ics_url FROM personal_gcal_link WHERE company_id = ? AND LOWER(username) = LOWER(?)",
                rs -> rs.next() ? rs.getString(1) : null, COMPANY, user.username());
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        if (url == null) {
            body.put("linked", false);
            body.put("events", java.util.List.of());
            return ResponseEntity.ok(body);
        }
        try {
            body.put("linked", true);
            body.put("events", googleCalendarService.events(url, LocalDate.parse(from), LocalDate.parse(to)));
        } catch (Exception e) {
            body.put("linked", true);
            body.put("events", java.util.List.of());
            body.put("error", "캘린더를 불러오지 못했습니다. 잠시 후 다시 시도하세요.");
        }
        return ResponseEntity.ok(body);
    }

    /* ── 유틸 ── */

    private static AuthUser user(HttpServletRequest request) {
        return (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
    }

    private static String str(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static java.sql.Time time(Object value) {
        if (value == null) return null;
        String v = String.valueOf(value).trim();
        if (v.isEmpty()) return null;
        try {
            return java.sql.Time.valueOf(LocalTime.parse(v.length() == 5 ? v + ":00" : v));
        } catch (Exception e) {
            return null;
        }
    }
}
