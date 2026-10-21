package naeil.dashboard.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관제실 '실무진 판단 필요' 카드의 판단(승인·진행 중·보류·거절).
 * 판단할 때마다 staff_decision 에 쌓고, 같은 내용을 상담·미팅 기록(contact_log)에 자동으로 남긴다.
 */
@Service
@RequiredArgsConstructor
public class StaffDecisionService {

    private static final Map<String, String> LABEL = Map.of(
            "APPROVED", "승인", "RUNNING", "진행 중", "HOLD", "보류", "REJECTED", "거절");

    private final JdbcTemplate jdbcTemplate;
    private final ContactLogService contactLogService;

    /** 최근 60일, 카드별 최신 판단. */
    public List<Map<String, Object>> latest(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT DISTINCT ON (item_key) id, item_key, kind, partner_name, partner_email, owner_name, status,
                       reason, next_steps, details, decided_by, contact_log_id,
                       TO_CHAR(decided_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS') || '+09:00' AS decided_at
                FROM staff_decision
                WHERE company_id = ? AND decided_at >= NOW() - INTERVAL '60 days'
                ORDER BY item_key, decided_at DESC
                """, companyId);
    }

    @Transactional
    public Map<String, Object> decide(Long companyId, Map<String, Object> body, String actor) {
        String key = required(body, "itemKey", 300);
        String partner = required(body, "partnerName", 200);
        String status = text(body.get("status"));
        if (status == null || !LABEL.containsKey(status.toUpperCase())) throw new CustomException(400, "승인·진행 중·보류·거절 중 하나를 선택해 주세요.");
        status = status.toUpperCase();
        String reason = text(body.get("reason"));
        if (("HOLD".equals(status) || "REJECTED".equals(status)) && reason == null) {
            throw new CustomException(400, LABEL.get(status) + " 사유를 적어 주세요.");
        }
        String kind = limit(text(body.get("kind")), 60);
        String owner = limit(text(body.get("ownerName")), 100);
        String steps = text(body.get("nextSteps"));
        String details = text(body.get("details"));
        String email = limit(text(body.get("partnerEmail")), 200);

        // 상담·미팅 기록에 같은 내용 남기기 (거절은 종료, 나머지는 진행 중으로)
        StringBuilder summary = new StringBuilder("[실무진 판단] ").append(LABEL.get(status));
        if (kind != null) summary.append(" — ").append(kind);
        if (email != null) summary.append(" (").append(email).append(")");
        if (reason != null) summary.append("\n").append("HOLD".equals(status) || "REJECTED".equals(status) ? "사유: " : "메모: ").append(reason);
        Map<String, Object> log = new LinkedHashMap<>();
        log.put("partnerName", partner);
        log.put("contactType", "OTHER");
        log.put("staffName", owner);
        log.put("summary", summary.toString());
        if (details != null) log.put("agreements", details);
        if (steps != null && !"REJECTED".equals(status)) log.put("nextAction", steps);
        log.put("status", "REJECTED".equals(status) ? "DONE" : "OPEN");
        Map<String, Object> saved = contactLogService.create(companyId, log, "MANUAL", actor);
        Long logId = ((Number) saved.get("id")).longValue();

        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO staff_decision (company_id, item_key, kind, partner_name, partner_email, owner_name, status,
                    reason, next_steps, details, decided_by, contact_log_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class, companyId, key, kind, partner, email, owner, status, reason, steps, details,
                limit(actor, 100), logId);
        int tasks = syncTasks(companyId, partner, email, status, reason, actor);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("tasks_updated", tasks);
        result.put("item_key", key);
        result.put("status", status);
        result.put("contact_log_id", logId);
        return result;
    }

    /**
     * 같은 거래처의 AI 배정 업무(내 업무 목록) 상태도 함께 맞춘다.
     * 승인·진행 중 → 진행 중 / 보류 → 막힘(사유 기록) / 거절 → 완료. 업체명 또는 이메일이 업무에 들어 있는 열린 업무만.
     */
    private int syncTasks(Long companyId, String partner, String email, String status, String reason, String actor) {
        String taskStatus = switch (status) {
            case "REJECTED" -> "DONE";
            case "HOLD" -> "BLOCKED";
            default -> "IN_PROGRESS";
        };
        String note = "[실무진 판단 " + LABEL.get(status) + " · " + (actor == null ? "-" : actor) + "]" + (reason == null ? "" : " " + reason);
        String name = partner.contains("|") ? partner.substring(partner.indexOf('|') + 1).trim() : partner;
        return jdbcTemplate.update("""
                UPDATE executive_work_task
                SET status = CAST(? AS VARCHAR),
                    progress_rate = CASE WHEN CAST(? AS VARCHAR) = 'DONE' THEN 100 ELSE GREATEST(progress_rate, 10) END,
                    completed_date = CASE WHEN CAST(? AS VARCHAR) = 'DONE' THEN CURRENT_DATE ELSE completed_date END,
                    blocker_text = CASE WHEN CAST(? AS VARCHAR) = 'BLOCKED' THEN CAST(? AS TEXT) ELSE blocker_text END,
                    review_comment = CONCAT_WS(E'\\n', review_comment, CAST(? AS TEXT)),
                    updated_at = NOW()
                WHERE company_id = ?
                  AND status NOT IN ('DONE', 'CANCELLED')
                  AND source_type IN ('AI_AGENT', 'AI_DIRECTIVE')
                  AND (STRPOS(LOWER(task_name), LOWER(?)) > 0
                       OR (CAST(? AS VARCHAR) <> '' AND STRPOS(LOWER(COALESCE(next_action, '')), LOWER(?)) > 0))
                """, taskStatus, taskStatus, taskStatus, taskStatus, reason, note, companyId,
                "] " + name, email == null ? "" : email, email == null ? "" : email);
    }

    private static String text(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static String limit(String s, int max) { return s == null || s.length() <= max ? s : s.substring(0, max); }

    private static String required(Map<String, Object> body, String key, int max) {
        String s = text(body == null ? null : body.get(key));
        if (s == null) throw new CustomException(400, key + " 값이 필요합니다.");
        return limit(s, max);
    }
}
