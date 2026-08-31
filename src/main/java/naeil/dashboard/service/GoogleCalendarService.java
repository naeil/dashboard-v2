package naeil.dashboard.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 구글 캘린더 비공개 iCal(.ics) 주소를 읽어 일정으로 변환.
 * OAuth 없이 사용자당 URL 1개 등록으로 실시간(5분 캐시) 조회.
 * RRULE은 실무에서 쓰는 DAILY/WEEKLY(INTERVAL·BYDAY·UNTIL·COUNT)와 EXDATE까지 전개한다.
 */
@Slf4j
@Service
public class GoogleCalendarService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final long CACHE_MS = 5 * 60_000L;
    private static final DateTimeFormatter BASIC_DT = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");
    private static final DateTimeFormatter BASIC_D = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(15))
            .build();
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private record CacheEntry(long at, List<Map<String, Object>> raw) { }

    /** 이벤트: {date, start(HH:mm|null), end, title, allDay} — [from, to] 범위만 */
    public List<Map<String, Object>> events(String icsUrl, LocalDate from, LocalDate to) {
        List<Map<String, Object>> vevents = fetchParsed(icsUrl);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> ve : vevents) {
            expand(ve, from, to, out);
        }
        out.sort((a, b) -> {
            int c = String.valueOf(a.get("date")).compareTo(String.valueOf(b.get("date")));
            if (c != 0) return c;
            String sa = a.get("start") == null ? "" : String.valueOf(a.get("start"));
            String sb = b.get("start") == null ? "" : String.valueOf(b.get("start"));
            return sa.compareTo(sb);
        });
        return out;
    }

    public static boolean isValidIcsUrl(String url) {
        if (url == null) return false;
        String v = url.trim();
        return v.startsWith("https://calendar.google.com/") && v.contains(".ics");
    }

    /* ───────── ICS 파싱 ───────── */

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchParsed(String icsUrl) {
        CacheEntry entry = cache.get(icsUrl);
        if (entry != null && System.currentTimeMillis() - entry.at() < CACHE_MS) {
            return entry.raw();
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(icsUrl.trim()))
                    .timeout(Duration.ofSeconds(25)).GET().build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 || response.body() == null) {
                throw new IllegalStateException("ICS 응답 오류: " + response.statusCode());
            }
            List<Map<String, Object>> parsed = parseIcs(response.body());
            cache.put(icsUrl, new CacheEntry(System.currentTimeMillis(), parsed));
            return parsed;
        } catch (Exception e) {
            log.warn("[GCal] ICS 읽기 실패: {}", e.getMessage());
            if (entry != null) return entry.raw(); // 만료 캐시라도 재사용
            throw new IllegalStateException("캘린더를 읽지 못했습니다. 비공개 iCal 주소가 맞는지 확인하세요.");
        }
    }

    private static List<Map<String, Object>> parseIcs(String body) {
        // 줄 접힘 해제 (다음 줄이 공백/탭으로 시작하면 이어붙임)
        String unfolded = body.replace("\r\n", "\n").replaceAll("\n[ \t]", "");
        List<Map<String, Object>> events = new ArrayList<>();
        Map<String, Object> current = null;
        for (String line : unfolded.split("\n")) {
            if (line.startsWith("BEGIN:VEVENT")) {
                current = new HashMap<>();
                current.put("exdates", new HashSet<String>());
            } else if (line.startsWith("END:VEVENT")) {
                if (current != null && current.containsKey("dtstart")) events.add(current);
                current = null;
            } else if (current != null) {
                int colon = line.indexOf(':');
                if (colon < 0) continue;
                String key = line.substring(0, colon);
                String value = line.substring(colon + 1).trim();
                String name = key.contains(";") ? key.substring(0, key.indexOf(';')) : key;
                switch (name) {
                    case "SUMMARY" -> current.put("title", value.replace("\\,", ",").replace("\\n", " "));
                    case "DTSTART" -> current.put("dtstart", parseDt(key, value));
                    case "DTEND" -> current.put("dtend", parseDt(key, value));
                    case "RRULE" -> current.put("rrule", value);
                    case "STATUS" -> current.put("status", value);
                    case "EXDATE" -> {
                        @SuppressWarnings("unchecked")
                        Set<String> ex = (Set<String>) current.get("exdates");
                        for (String part : value.split(",")) {
                            DtValue dv = parseDt(key, part.trim());
                            if (dv != null) ex.add(dv.dateTime().toLocalDate().toString());
                        }
                    }
                    default -> { }
                }
            }
        }
        return events;
    }

    private record DtValue(LocalDateTime dateTime, boolean allDay) { }

    private static DtValue parseDt(String key, String value) {
        try {
            if (key.contains("VALUE=DATE") || value.length() == 8) {
                return new DtValue(LocalDate.parse(value, BASIC_D).atStartOfDay(), true);
            }
            if (value.endsWith("Z")) {
                Instant instant = Instant.from(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")
                        .withZone(ZoneId.of("UTC")).parse(value));
                return new DtValue(LocalDateTime.ofInstant(instant, KST), false);
            }
            LocalDateTime local = LocalDateTime.parse(value, BASIC_DT);
            if (key.contains("TZID=")) {
                String tzid = key.replaceAll(".*TZID=([^;:]+).*", "$1");
                try {
                    return new DtValue(local.atZone(ZoneId.of(tzid)).withZoneSameInstant(KST).toLocalDateTime(), false);
                } catch (Exception ignored) {
                    return new DtValue(local, false);
                }
            }
            return new DtValue(local, false);
        } catch (Exception e) {
            return null;
        }
    }

    /* ───────── RRULE 전개 ───────── */

    @SuppressWarnings("unchecked")
    private static void expand(Map<String, Object> ve, LocalDate from, LocalDate to, List<Map<String, Object>> out) {
        DtValue start = (DtValue) ve.get("dtstart");
        if (start == null) return;
        if ("CANCELLED".equals(ve.get("status"))) return;
        DtValue end = (DtValue) ve.get("dtend");
        Set<String> exdates = (Set<String>) ve.get("exdates");
        String title = String.valueOf(ve.getOrDefault("title", "(제목 없음)"));
        String rrule = (String) ve.get("rrule");

        if (rrule == null) {
            emitIfInRange(out, start, end, title, start.dateTime().toLocalDate(), from, to, exdates);
            return;
        }

        Map<String, String> rule = new LinkedHashMap<>();
        for (String part : rrule.split(";")) {
            int eq = part.indexOf('=');
            if (eq > 0) rule.put(part.substring(0, eq), part.substring(eq + 1));
        }
        String freq = rule.getOrDefault("FREQ", "");
        int interval = parseInt(rule.get("INTERVAL"), 1);
        Integer count = rule.containsKey("COUNT") ? parseInt(rule.get("COUNT"), 0) : null;
        LocalDate until = null;
        if (rule.containsKey("UNTIL")) {
            DtValue u = parseDt("UNTIL", rule.get("UNTIL"));
            if (u != null) until = u.dateTime().toLocalDate();
        }
        LocalDate hardStop = until == null || until.isAfter(to) ? to : until;

        LocalDate startDate = start.dateTime().toLocalDate();
        int emittedTotal = 0;
        if ("DAILY".equals(freq)) {
            LocalDate d = startDate;
            int guard = 0;
            while (!d.isAfter(hardStop) && guard++ < 800) {
                if (count != null && ++emittedTotal > count) break;
                emitIfInRange(out, start, end, title, d, from, to, exdates);
                d = d.plusDays(interval);
            }
        } else if ("WEEKLY".equals(freq)) {
            Set<java.time.DayOfWeek> byDays = new HashSet<>();
            if (rule.containsKey("BYDAY")) {
                for (String bd : rule.get("BYDAY").split(",")) {
                    java.time.DayOfWeek dow = dow(bd.trim());
                    if (dow != null) byDays.add(dow);
                }
            }
            if (byDays.isEmpty()) byDays.add(start.dateTime().getDayOfWeek());
            LocalDate weekAnchor = startDate.with(java.time.DayOfWeek.MONDAY);
            int guard = 0;
            outer:
            while (!weekAnchor.isAfter(hardStop) && guard++ < 300) {
                for (int i = 0; i < 7; i++) {
                    LocalDate d = weekAnchor.plusDays(i);
                    if (d.isBefore(startDate) || d.isAfter(hardStop)) continue;
                    if (!byDays.contains(d.getDayOfWeek())) continue;
                    if (count != null && ++emittedTotal > count) break outer;
                    emitIfInRange(out, start, end, title, d, from, to, exdates);
                }
                weekAnchor = weekAnchor.plusWeeks(interval);
            }
        } else {
            // MONTHLY/YEARLY 등은 원본 1회만 표시 (업무 캘린더에선 드묾)
            emitIfInRange(out, start, end, title, startDate, from, to, exdates);
        }
    }

    private static void emitIfInRange(List<Map<String, Object>> out, DtValue start, DtValue end, String title,
                                      LocalDate date, LocalDate from, LocalDate to, Set<String> exdates) {
        if (date.isBefore(from) || date.isAfter(to)) return;
        if (exdates != null && exdates.contains(date.toString())) return;
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("date", date.toString());
        event.put("title", title);
        event.put("allDay", start.allDay());
        event.put("start", start.allDay() ? null : String.format("%02d:%02d",
                start.dateTime().getHour(), start.dateTime().getMinute()));
        event.put("end", end == null || end.allDay() ? null : String.format("%02d:%02d",
                end.dateTime().getHour(), end.dateTime().getMinute()));
        out.add(event);
    }

    private static java.time.DayOfWeek dow(String code) {
        return switch (code.replaceAll("[+-]?\\d*", "")) {
            case "MO" -> java.time.DayOfWeek.MONDAY;
            case "TU" -> java.time.DayOfWeek.TUESDAY;
            case "WE" -> java.time.DayOfWeek.WEDNESDAY;
            case "TH" -> java.time.DayOfWeek.THURSDAY;
            case "FR" -> java.time.DayOfWeek.FRIDAY;
            case "SA" -> java.time.DayOfWeek.SATURDAY;
            case "SU" -> java.time.DayOfWeek.SUNDAY;
            default -> null;
        };
    }

    private static int parseInt(String value, int fallback) {
        try {
            return Integer.parseInt(value);
        } catch (Exception e) {
            return fallback;
        }
    }
}
