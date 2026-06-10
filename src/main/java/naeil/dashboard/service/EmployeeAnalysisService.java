package naeil.dashboard.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 직원 성과 AI 분석 서비스
 * - 직원별 업무 데이터를 Claude(OpenAI) API로 분석
 * - 분석 결과를 employee_ai_analysis 테이블에 저장
 * - 대표 피드백 저장/조회
 */
@Service
@RequiredArgsConstructor
public class EmployeeAnalysisService {

    private final JdbcTemplate jdbcTemplate;
    private final ClaudeApiClient claudeApiClient;

    // ── 직원 상세 업무 데이터 조회 ─────────────────────────────────────────

    /**
     * 직원의 업무(work_task) + 업무보고(staff_work_report) 통합 데이터 반환
     */
    public Map<String, Object> getEmployeeDetail(Long companyId, String username) {
        List<Map<String, Object>> tasks = jdbcTemplate.queryForList("""
            SELECT id, project_name, task_name, work_category, status,
                   progress_rate, due_date, priority,
                   today_work, blocker_text, next_action,
                   start_date, completed_date, approval_required,
                   CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('DONE','BLOCKED') THEN true ELSE false END AS is_delayed
            FROM executive_work_task
            WHERE company_id = ?
              AND LOWER(assignee_name) = LOWER(?)
            ORDER BY
              CASE WHEN status = 'BLOCKED' THEN 0
                   WHEN due_date < CURRENT_DATE AND status NOT IN ('DONE','BLOCKED') THEN 1
                   WHEN status = 'IN_PROGRESS' THEN 2
                   ELSE 3 END,
              due_date ASC NULLS LAST
            LIMIT 100
            """, companyId, username);

        List<Map<String, Object>> reports = jdbcTemplate.queryForList("""
            SELECT id, report_type, report_date, title,
                   completed_work, planned_work, blockers, status
            FROM staff_work_report
            WHERE company_id = ?
              AND LOWER(username) = LOWER(?)
            ORDER BY report_date DESC, id DESC
            LIMIT 20
            """, companyId, username);

        // 카테고리별 집계
        Map<String, Integer> categoryMap = new LinkedHashMap<>();
        for (Map<String, Object> t : tasks) {
            String cat = t.get("work_category") != null ? t.get("work_category").toString() : "기타";
            categoryMap.merge(cat, 1, Integer::sum);
        }

        long delayed = tasks.stream()
            .filter(t -> Boolean.TRUE.equals(t.get("is_delayed"))).count();
        long blocked = tasks.stream()
            .filter(t -> "BLOCKED".equals(t.get("status"))).count();
        long done    = tasks.stream()
            .filter(t -> "DONE".equals(t.get("status"))).count();
        long active  = tasks.stream()
            .filter(t -> !List.of("DONE","BLOCKED").contains(t.get("status"))).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tasks", tasks);
        result.put("reports", reports);
        result.put("categoryBreakdown", categoryMap);
        result.put("stats", Map.of(
            "total", tasks.size(),
            "active", active,
            "done", done,
            "delayed", delayed,
            "blocked", blocked
        ));
        return result;
    }

    // ── AI 분석 ──────────────────────────────────────────────────────────

    /**
     * 직원 업무 데이터를 AI에게 보내 분석 결과를 DB에 저장
     */
    public Map<String, Object> analyzeEmployee(Long companyId, String username, String displayName) {
        Map<String, Object> detail = getEmployeeDetail(companyId, username);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tasks   = (List<Map<String, Object>>) detail.get("tasks");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> reports = (List<Map<String, Object>>) detail.get("reports");
        @SuppressWarnings("unchecked")
        Map<String, Object> stats = (Map<String, Object>) detail.get("stats");

        String systemPrompt = """
            당신은 HR 전문가입니다. 직원의 업무 데이터를 분석하여 다음 4가지 항목을 한국어로 작성해주세요.
            반드시 아래 JSON 형식으로만 응답하세요:
            {
              "strengths": "강점 내용 (2-3문장)",
              "weaknesses": "약점 내용 (2-3문장)",
              "issues": "현재 문제점 (2-3문장)",
              "improvements": "개선 방향 (2-3문장)"
            }
            """;

        String userMessage = buildAnalysisPrompt(displayName, tasks, reports, stats);

        String aiResponse;
        try {
            aiResponse = claudeApiClient.complete(systemPrompt, userMessage);
        } catch (Exception e) {
            throw new CustomException(500, "AI 분석 중 오류가 발생했습니다: " + e.getMessage());
        }

        // JSON 파싱 시도
        Map<String, String> parsed = parseAnalysisJson(aiResponse);

        // DB 저장
        jdbcTemplate.update("""
            INSERT INTO employee_ai_analysis
              (company_id, username, display_name, strengths, weaknesses, issues, improvements, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            companyId, username, displayName,
            parsed.get("strengths"), parsed.get("weaknesses"),
            parsed.get("issues"), parsed.get("improvements"),
            aiResponse
        );

        Long newId = jdbcTemplate.queryForObject("""
            SELECT id FROM employee_ai_analysis
            WHERE company_id = ? AND LOWER(username) = LOWER(?)
            ORDER BY id DESC LIMIT 1
            """, Long.class, companyId, username);

        return getAnalysis(newId);
    }

    // ── 분석 이력 조회 ───────────────────────────────────────────────────

    public List<Map<String, Object>> listAnalyses(Long companyId, String username) {
        if (username != null && !username.isBlank()) {
            return jdbcTemplate.queryForList("""
                SELECT id, username, display_name, strengths, weaknesses, issues, improvements,
                       ceo_feedback, feedback_by, feedback_at, analyzed_at
                FROM employee_ai_analysis
                WHERE company_id = ? AND LOWER(username) = LOWER(?)
                ORDER BY analyzed_at DESC
                LIMIT 20
                """, companyId, username);
        }
        return jdbcTemplate.queryForList("""
            SELECT id, username, display_name, strengths, weaknesses, issues, improvements,
                   ceo_feedback, feedback_by, feedback_at, analyzed_at
            FROM employee_ai_analysis
            WHERE company_id = ?
            ORDER BY analyzed_at DESC
            LIMIT 50
            """, companyId);
    }

    public Map<String, Object> getAnalysis(Long id) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT * FROM employee_ai_analysis WHERE id = ?
            """, id);
        if (rows.isEmpty()) throw new CustomException(404, "분석 결과를 찾을 수 없습니다.");
        return rows.get(0);
    }

    // ── 대표 피드백 저장 ─────────────────────────────────────────────────

    public Map<String, Object> saveFeedback(Long analysisId, String feedback, String feedbackBy) {
        int updated = jdbcTemplate.update("""
            UPDATE employee_ai_analysis
            SET ceo_feedback = ?, feedback_by = ?, feedback_at = NOW(), updated_at = NOW()
            WHERE id = ?
            """, feedback, feedbackBy, analysisId);
        if (updated == 0) throw new CustomException(404, "분석 결과를 찾을 수 없습니다.");
        return getAnalysis(analysisId);
    }

    // ── 내부 헬퍼 ────────────────────────────────────────────────────────

    private String buildAnalysisPrompt(String displayName,
                                       List<Map<String, Object>> tasks,
                                       List<Map<String, Object>> reports,
                                       Map<String, Object> stats) {
        StringBuilder sb = new StringBuilder();
        sb.append("직원명: ").append(displayName).append("\n\n");
        sb.append("=== 업무 현황 통계 ===\n");
        sb.append("전체: ").append(stats.get("total"))
          .append(", 진행중: ").append(stats.get("active"))
          .append(", 완료: ").append(stats.get("done"))
          .append(", 지연: ").append(stats.get("delayed"))
          .append(", 막힘: ").append(stats.get("blocked")).append("\n\n");

        sb.append("=== 업무 목록 (최근 20건) ===\n");
        int taskLimit = Math.min(tasks.size(), 20);
        for (int i = 0; i < taskLimit; i++) {
            Map<String, Object> t = tasks.get(i);
            sb.append("- [").append(t.get("status")).append("] ");
            sb.append(t.get("project_name")).append(" / ").append(t.get("task_name"));
            sb.append(" (진행률: ").append(t.get("progress_rate")).append("%)");
            if (Boolean.TRUE.equals(t.get("is_delayed"))) sb.append(" [지연]");
            if (t.get("blocker_text") != null) sb.append(" 블로커: ").append(t.get("blocker_text"));
            sb.append("\n");
        }

        if (!reports.isEmpty()) {
            sb.append("\n=== 최근 업무보고 (최근 5건) ===\n");
            int reportLimit = Math.min(reports.size(), 5);
            for (int i = 0; i < reportLimit; i++) {
                Map<String, Object> r = reports.get(i);
                sb.append("- [").append(r.get("report_date")).append("] ").append(r.get("title")).append("\n");
                if (r.get("completed_work") != null) sb.append("  완료: ").append(r.get("completed_work")).append("\n");
                if (r.get("blockers") != null) sb.append("  블로커: ").append(r.get("blockers")).append("\n");
            }
        }

        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> parseAnalysisJson(String aiResponse) {
        Map<String, String> result = new LinkedHashMap<>();
        result.put("strengths", "");
        result.put("weaknesses", "");
        result.put("issues", "");
        result.put("improvements", "");

        try {
            // JSON 블록 추출
            String json = aiResponse;
            int start = aiResponse.indexOf('{');
            int end   = aiResponse.lastIndexOf('}');
            if (start >= 0 && end > start) {
                json = aiResponse.substring(start, end + 1);
            }
            // 간단한 파싱 (Jackson 없이)
            for (String key : List.of("strengths", "weaknesses", "issues", "improvements")) {
                String pattern = "\"" + key + "\"\s*:\s*\"";
                int idx = json.indexOf("\"" + key + "\"");
                if (idx < 0) continue;
                int colonIdx = json.indexOf(':', idx);
                if (colonIdx < 0) continue;
                int quoteStart = json.indexOf('"', colonIdx + 1);
                if (quoteStart < 0) continue;
                int quoteEnd = quoteStart + 1;
                while (quoteEnd < json.length()) {
                    if (json.charAt(quoteEnd) == '"' && json.charAt(quoteEnd - 1) != '\\') break;
                    quoteEnd++;
                }
                result.put(key, json.substring(quoteStart + 1, quoteEnd)
                               .replace("\\n", "\n").replace("\\\"", "\""));
            }
        } catch (Exception e) {
            // 파싱 실패 시 전체 응답을 strengths에 저장
            result.put("strengths", aiResponse);
        }
        return result;
    }
}
