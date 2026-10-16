package naeil.dashboard.service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 상담·미팅 기록 — 영업 담당자가 거래처와 전화·줌·대면으로 나눈 내용, 합의 사항, 다음 할 일.
 * 다음 할 일은 요청 시 담당자 업무(executive_work_task, source_type = CONTACT_LOG)로 등록한다.
 * 운영 에이전트도 /api/agent/ingest/contact-logs 로 읽고 쓴다(source = AGENT).
 */
@Service
@RequiredArgsConstructor
public class ContactLogService {

    public static final String TASK_SOURCE_TYPE = "CONTACT_LOG";
    private static final String TASK_PROJECT_NAME = "상담 후속";
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Set<String> TYPES = Set.of("PHONE", "ZOOM", "MEETING", "OTHER");
    private static final Set<String> STATUSES = Set.of("OPEN", "DONE");

    private static final String SELECT_COLUMNS = """
            SELECT id, partner_name, contact_type,
                   TO_CHAR(occurred_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS') || '+09:00' AS occurred_at,
                   staff_name, attendees, summary, agreements, next_action,
                   TO_CHAR(next_due, 'YYYY-MM-DD') AS next_due,
                   status, related_task_id, source, created_by,
                   TO_CHAR(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS') || '+09:00' AS created_at,
                   TO_CHAR(updated_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS') || '+09:00' AS updated_at
            FROM contact_log
            """;

    private final JdbcTemplate jdbcTemplate;
    private final AgentWorkService agentWorkService;

    // ===== 조회 =====

    /** 목록: q(거래처 검색) · staff · status · type · from/to(yyyy-MM-dd, 일시 기준) · 최신순. */
    public List<Map<String, Object>> list(Long companyId, String q, String staff, String status, String type,
                                          String from, String to, int limit) {
        StringBuilder sql = new StringBuilder(SELECT_COLUMNS).append(" WHERE company_id = ?");
        List<Object> params = new ArrayList<>();
        params.add(companyId);
        if (notBlank(q)) {
            sql.append(" AND partner_name ILIKE ?");
            params.add("%" + q.trim() + "%");
        }
        if (notBlank(staff)) {
            sql.append(" AND staff_name = ?");
            params.add(staff.trim());
        }
        if (notBlank(status)) {
            sql.append(" AND status = ?");
            params.add(status.trim().toUpperCase());
        }
        if (notBlank(type)) {
            sql.append(" AND contact_type = ?");
            params.add(type.trim().toUpperCase());
        }
        if (notBlank(from)) {
            sql.append(" AND occurred_at >= ?");
            params.add(Timestamp.from(parseDay(from, "from").atStartOfDay(SEOUL).toInstant()));
        }
        if (notBlank(to)) {
            sql.append(" AND occurred_at < ?");
            params.add(Timestamp.from(parseDay(to, "to").plusDays(1).atStartOfDay(SEOUL).toInstant()));
        }
        sql.append(" ORDER BY occurred_at DESC, id DESC LIMIT ?");
        params.add(Math.max(1, Math.min(limit, 1000)));
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    /** 에이전트용: since(ISO 시각) 이후 새로 쓰였거나 고쳐진 기록. 없으면 최근 7일. */
    public List<Map<String, Object>> since(Long companyId, String since, int limit) {
        Instant from = notBlank(since) ? parseInstant(since, "since") : Instant.now().minus(7, ChronoUnit.DAYS);
        return jdbcTemplate.queryForList(SELECT_COLUMNS + """
                 WHERE company_id = ? AND updated_at >= ?
                ORDER BY occurred_at DESC, id DESC
                LIMIT ?
                """, companyId, Timestamp.from(from), Math.max(1, Math.min(limit, 1000)));
    }

    public Map<String, Object> get(Long companyId, Long id) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                SELECT_COLUMNS + " WHERE company_id = ? AND id = ?", companyId, id);
        if (rows.isEmpty()) throw new CustomException(404, "상담·미팅 기록을 찾을 수 없습니다.");
        return rows.get(0);
    }

    // ===== 쓰기 =====

    /** 새 기록. source = MANUAL/AGENT, createdBy = 작성자 이름. body.createTask = true면 다음 할 일을 담당자 업무로 등록. */
    @Transactional
    public Map<String, Object> create(Long companyId, Map<String, Object> body, String source, String createdBy) {
        Fields f = Fields.from(body, true);
        String status = f.status == null ? "OPEN" : f.status;
        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO contact_log
                    (company_id, partner_name, contact_type, occurred_at, staff_name, attendees, summary,
                     agreements, next_action, next_due, status, source, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                RETURNING id
                """, Long.class, companyId, f.partnerName, f.contactType, Timestamp.from(f.occurredAt), f.staffName,
                f.attendees, f.summary, f.agreements, f.nextAction, sqlDate(f.nextDue), status, source,
                cut(createdBy, 100));
        return afterWrite(companyId, id, f, isTrue(body.get("createTask")), null);
    }

    /** 수정: 전체 필드를 다시 저장한다(status는 보낼 때만 바꿈). */
    @Transactional
    public Map<String, Object> update(Long companyId, Long id, Map<String, Object> body) {
        Map<String, Object> current = get(companyId, id);
        Fields f = Fields.from(body, false);
        jdbcTemplate.update("""
                UPDATE contact_log
                SET partner_name = ?, contact_type = ?, occurred_at = ?, staff_name = ?, attendees = ?,
                    summary = ?, agreements = ?, next_action = ?, next_due = ?,
                    status = COALESCE(CAST(? AS VARCHAR), status), updated_at = NOW()
                WHERE company_id = ? AND id = ?
                """, f.partnerName, f.contactType, Timestamp.from(f.occurredAt), f.staffName, f.attendees,
                f.summary, f.agreements, f.nextAction, sqlDate(f.nextDue), f.status, companyId, id);
        Object related = current.get("related_task_id");
        return afterWrite(companyId, id, f, isTrue(body.get("createTask")), related);
    }

    public Map<String, Object> updateStatus(Long companyId, Long id, String status) {
        String s = status == null ? "" : status.trim().toUpperCase();
        if (!STATUSES.contains(s)) throw new CustomException(400, "status는 OPEN 또는 DONE 입니다.");
        int updated = jdbcTemplate.update(
                "UPDATE contact_log SET status = ?, updated_at = NOW() WHERE company_id = ? AND id = ?",
                s, companyId, id);
        if (updated == 0) throw new CustomException(404, "상담·미팅 기록을 찾을 수 없습니다.");
        return get(companyId, id);
    }

    public Map<String, Object> delete(Long companyId, Long id) {
        int deleted = jdbcTemplate.update("DELETE FROM contact_log WHERE company_id = ? AND id = ?", companyId, id);
        if (deleted == 0) throw new CustomException(404, "상담·미팅 기록을 찾을 수 없습니다.");
        return Map.of("success", true);
    }

    /** 저장 후 처리: 요청 시 후속 업무 등록(이미 연결된 업무가 있으면 다시 만들지 않음) → 저장된 행 반환. */
    private Map<String, Object> afterWrite(Long companyId, Long id, Fields f, boolean createTask, Object existingTaskId) {
        String taskNote = null;
        Long taskId = null;
        if (createTask) {
            if (existingTaskId != null) {
                taskNote = "이미 업무로 등록된 기록입니다.";
            } else if (!notBlank(f.nextAction) || !notBlank(f.staffName)) {
                taskNote = "다음 할 일과 우리 담당자가 있어야 업무로 등록할 수 있습니다.";
            } else {
                String taskName = "[상담 후속] " + f.partnerName + " — " + headOf(f.nextAction, 40);
                StringBuilder content = new StringBuilder();
                if (notBlank(f.agreements)) content.append("합의 사항:\n").append(f.agreements.trim()).append("\n\n");
                content.append("다음 할 일:\n").append(f.nextAction.trim());
                taskId = agentWorkService.insertTask(companyId, TASK_SOURCE_TYPE, "CONTACT_LOG:" + id,
                        cut(TASK_PROJECT_NAME, 160), cut(taskName, 220), cut(f.staffName, 80), "MEDIUM",
                        f.nextDue, content.toString());
                jdbcTemplate.update("UPDATE contact_log SET related_task_id = ? WHERE company_id = ? AND id = ?",
                        taskId, companyId, id);
            }
        }
        Map<String, Object> row = get(companyId, id);
        row.put("taskCreated", taskId != null);
        if (taskNote != null) row.put("taskNote", taskNote);
        return row;
    }

    // ===== 입력 정리 =====

    private static final class Fields {
        String partnerName;
        String contactType;
        Instant occurredAt;
        String staffName;
        String attendees;
        String summary;
        String agreements;
        String nextAction;
        LocalDate nextDue;
        String status;

        static Fields from(Map<String, Object> body, boolean creating) {
            if (body == null) throw new CustomException(400, "요청 내용이 비어 있습니다.");
            Fields f = new Fields();
            f.partnerName = cut(requiredText(body, "partnerName", "partner_name", "거래처"), 200);
            f.contactType = contactType(pick(body, "contactType", "contact_type"));
            String occurred = pick(body, "occurredAt", "occurred_at");
            if (notBlank(occurred)) f.occurredAt = parseInstant(occurred, "occurredAt");
            else if (creating) f.occurredAt = Instant.now();
            else throw new CustomException(400, "일시 값이 필요합니다.");
            f.staffName = cut(blankToNull(pick(body, "staffName", "staff_name")), 100);
            f.attendees = blankToNull(pick(body, "attendees", "attendees"));
            f.summary = requiredText(body, "summary", "summary", "논의 내용");
            f.agreements = blankToNull(pick(body, "agreements", "agreements"));
            f.nextAction = blankToNull(pick(body, "nextAction", "next_action"));
            String due = pick(body, "nextDue", "next_due");
            f.nextDue = notBlank(due) ? parseDay(due, "nextDue") : null;
            String status = pick(body, "status", "status");
            if (notBlank(status)) {
                f.status = status.trim().toUpperCase();
                if (!STATUSES.contains(f.status)) throw new CustomException(400, "status는 OPEN 또는 DONE 입니다.");
            }
            return f;
        }
    }

    private static String contactType(String value) {
        if (!notBlank(value)) throw new CustomException(400, "방식(contactType) 값이 필요합니다.");
        String v = value.trim();
        String mapped = switch (v) {
            case "전화" -> "PHONE";
            case "줌", "화상" -> "ZOOM";
            case "대면", "미팅" -> "MEETING";
            case "기타" -> "OTHER";
            default -> v.toUpperCase();
        };
        if (!TYPES.contains(mapped)) throw new CustomException(400, "방식은 PHONE/ZOOM/MEETING/OTHER 중 하나입니다.");
        return mapped;
    }

    private static String pick(Map<String, Object> body, String camel, String snake) {
        Object value = body.containsKey(camel) ? body.get(camel) : body.get(snake);
        return value == null ? null : String.valueOf(value);
    }

    private static String requiredText(Map<String, Object> body, String camel, String snake, String label) {
        String value = pick(body, camel, snake);
        if (!notBlank(value)) throw new CustomException(400, label + " 값이 필요합니다.");
        return value.trim();
    }

    private static Instant parseInstant(String value, String key) {
        String v = value.trim();
        try {
            return OffsetDateTime.parse(v).toInstant();
        } catch (Exception ignored) {
            // 시간대 없는 값은 서울 시각으로 본다
        }
        try {
            return LocalDateTime.parse(v).atZone(SEOUL).toInstant();
        } catch (Exception ignored) {
            // 날짜만 온 경우 아래에서 처리
        }
        try {
            return LocalDate.parse(v).atStartOfDay(SEOUL).toInstant();
        } catch (Exception e) {
            throw new CustomException(400, key + " 형식은 ISO 시각(예: 2026-10-16T14:30:00+09:00)입니다.");
        }
    }

    private static LocalDate parseDay(String value, String key) {
        try {
            return LocalDate.parse(value.trim());
        } catch (Exception e) {
            throw new CustomException(400, key + " 형식은 yyyy-MM-dd 입니다.");
        }
    }

    private static java.sql.Date sqlDate(LocalDate date) {
        return date == null ? null : java.sql.Date.valueOf(date);
    }

    private static String headOf(String value, int max) {
        String oneLine = value.trim().replaceAll("\\s+", " ");
        return oneLine.length() <= max ? oneLine : oneLine.substring(0, max) + "…";
    }

    private static boolean isTrue(Object value) {
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static String blankToNull(String value) {
        return notBlank(value) ? value.trim() : null;
    }

    private static String cut(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
