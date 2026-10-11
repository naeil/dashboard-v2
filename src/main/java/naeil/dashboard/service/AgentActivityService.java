package naeil.dashboard.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * AI 에이전트 활동 패널 — 회사 PC 에이전트가 활동을 기록하고, 사람이 승인/반려한다.
 * 에이전트 쪽 호출은 X-Agent-Key(app.agent.api-key)로 인증한다.
 */
@Service
@RequiredArgsConstructor
public class AgentActivityService {

    private static final Set<String> KINDS = Set.of("TASK", "APPROVAL", "ALERT", "REPORT");
    /** 에이전트가 직접 바꿀 수 있는 상태. APPROVED/REJECTED는 사람만. */
    private static final Set<String> AGENT_STATUSES = Set.of("RUNNING", "DONE", "FAILED", "PENDING_APPROVAL");

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.agent.api-key:}")
    private String agentApiKey;

    public void requireAgentKey(String key) {
        if (agentApiKey == null || agentApiKey.isBlank()) {
            throw new CustomException(503, "에이전트 API가 설정되지 않았습니다.");
        }
        if (key == null || !constantTimeEquals(agentApiKey.trim(), key.trim())) {
            throw new CustomException(401, "에이전트 키가 올바르지 않습니다.");
        }
    }

    // ===== 에이전트 쪽 =====

    public Map<String, Object> create(Long companyId, Map<String, Object> body) {
        String agentName = required(body, "agentName", 60);
        String title = required(body, "title", 200);
        String kind = upper(body.get("kind"), "TASK");
        if (!KINDS.contains(kind)) throw new CustomException(400, "kind 값이 올바르지 않습니다.");
        String status = upper(body.get("status"), "APPROVAL".equals(kind) ? "PENDING_APPROVAL" : "RUNNING");
        if (!AGENT_STATUSES.contains(status)) throw new CustomException(400, "status 값이 올바르지 않습니다.");

        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO agent_activity (company_id, agent_name, kind, title, detail, status, result, link_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class, companyId, agentName, kind, title,
                text(body.get("detail")), status, text(body.get("result")), cut(text(body.get("linkUrl")), 500));
        return Map.of("id", id);
    }

    public Map<String, Object> agentUpdate(Long companyId, Long id, Map<String, Object> body) {
        String status = body.get("status") == null ? null : upper(body.get("status"), null);
        if (status != null && !AGENT_STATUSES.contains(status)) {
            throw new CustomException(400, "status 값이 올바르지 않습니다.");
        }
        int updated = jdbcTemplate.update("""
                UPDATE agent_activity
                SET status = COALESCE(?, status),
                    detail = COALESCE(?, detail),
                    result = COALESCE(?, result),
                    link_url = COALESCE(?, link_url),
                    updated_at = NOW()
                WHERE id = ? AND company_id = ?
                """, status, text(body.get("detail")), text(body.get("result")),
                cut(text(body.get("linkUrl")), 500), id, companyId);
        if (updated == 0) throw new CustomException(404, "활동을 찾을 수 없습니다.");
        return Map.of("success", true);
    }

    public void heartbeat(Long companyId, Map<String, Object> body) {
        String agentName = required(body, "agentName", 60);
        jdbcTemplate.update("""
                INSERT INTO agent_heartbeat (company_id, agent_name, status_text, host, last_seen_at)
                VALUES (?, ?, ?, ?, NOW())
                ON CONFLICT (company_id, agent_name)
                DO UPDATE SET status_text = EXCLUDED.status_text, host = EXCLUDED.host, last_seen_at = NOW()
                """, companyId, agentName, cut(text(body.get("statusText")), 200), cut(text(body.get("host")), 100));
    }

    /** 사람이 승인/반려했지만 에이전트가 아직 처리하지 않은 항목. */
    public List<Map<String, Object>> pendingDecisions(Long companyId, String agentName) {
        return jdbcTemplate.queryForList("""
                SELECT id, agent_name, kind, title, detail, status, decided_by, decided_at, decision_comment
                FROM agent_activity
                WHERE company_id = ? AND status IN ('APPROVED', 'REJECTED')
                  AND (CAST(? AS VARCHAR) IS NULL OR agent_name = CAST(? AS VARCHAR))
                ORDER BY decided_at
                LIMIT 50
                """, companyId, agentName, agentName);
    }

    // ===== 사람 쪽 =====

    public Map<String, Object> overview(Long companyId, int limit) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("agents", jdbcTemplate.queryForList("""
                SELECT agent_name, status_text, host, last_seen_at,
                       (last_seen_at > NOW() - INTERVAL '5 minutes') AS online
                FROM agent_heartbeat
                WHERE company_id = ?
                ORDER BY agent_name
                """, companyId));
        result.put("pending", jdbcTemplate.queryForList("""
                SELECT * FROM agent_activity
                WHERE company_id = ? AND status = 'PENDING_APPROVAL'
                ORDER BY created_at
                """, companyId));
        result.put("running", jdbcTemplate.queryForList("""
                SELECT * FROM agent_activity
                WHERE company_id = ? AND status = 'RUNNING'
                ORDER BY updated_at DESC
                """, companyId));
        result.put("recent", jdbcTemplate.queryForList("""
                SELECT * FROM agent_activity
                WHERE company_id = ? AND status NOT IN ('PENDING_APPROVAL', 'RUNNING')
                ORDER BY updated_at DESC
                LIMIT ?
                """, companyId, Math.max(1, Math.min(limit, 200))));
        result.put("todayCounts", jdbcTemplate.queryForMap("""
                SELECT COUNT(*) FILTER (WHERE status = 'DONE')   AS done,
                       COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
                       COUNT(*) FILTER (WHERE kind = 'ALERT')    AS alerts
                FROM agent_activity
                WHERE company_id = ? AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
                """, companyId));
        return result;
    }

    public Map<String, Object> decide(Long companyId, Long id, boolean approve, String comment, String username) {
        int updated = jdbcTemplate.update("""
                UPDATE agent_activity
                SET status = ?, decided_by = ?, decided_at = NOW(), decision_comment = ?, updated_at = NOW()
                WHERE id = ? AND company_id = ? AND status = 'PENDING_APPROVAL'
                """, approve ? "APPROVED" : "REJECTED", username, cut(comment, 300), id, companyId);
        if (updated == 0) throw new CustomException(409, "승인 대기 상태가 아니거나 이미 처리된 항목입니다.");
        return Map.of("success", true);
    }

    // ===== helpers =====

    private static String required(Map<String, Object> body, String key, int max) {
        String value = text(body.get(key));
        if (value == null || value.isBlank()) throw new CustomException(400, key + " 값이 필요합니다.");
        return cut(value.trim(), max);
    }

    private static String upper(Object value, String fallback) {
        String s = text(value);
        return s == null || s.isBlank() ? fallback : s.trim().toUpperCase();
    }

    private static String text(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String cut(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
