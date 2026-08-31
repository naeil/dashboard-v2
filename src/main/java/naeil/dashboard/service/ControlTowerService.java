package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 종합 상황판 — 프로젝트 진행 / 재발주 시점 / 개인별 업무·마감일을 한 화면 데이터로.
 * 소스: executive_work_task(업무·마감일), product_outbound·product.real_stock(재발주), 전부 기존 데이터 재활용.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ControlTowerService {

    private final JdbcTemplate jdbcTemplate;

    public Map<String, Object> getOverview(Long companyId) {
        Map<String, Object> result = new LinkedHashMap<>();

        // ① 프로젝트 현황 (열린 업무 + 완료 포함 진행률)
        List<Map<String, Object>> projects = jdbcTemplate.queryForList("""
                SELECT project_name,
                       COUNT(*)::int AS total_tasks,
                       COUNT(*) FILTER (WHERE status = 'DONE')::int AS done_tasks,
                       COUNT(*) FILTER (WHERE status <> 'DONE')::int AS open_tasks,
                       COUNT(*) FILTER (WHERE status <> 'DONE' AND (status IN ('DELAYED','BLOCKED') OR (due_date IS NOT NULL AND due_date < CURRENT_DATE)))::int AS delayed_tasks,
                       ROUND(AVG(progress_rate))::int AS avg_progress,
                       MIN(due_date) FILTER (WHERE status <> 'DONE') AS nearest_due,
                       STRING_AGG(DISTINCT assignee_name, ', ') AS assignees
                FROM executive_work_task
                WHERE company_id = ?
                GROUP BY project_name
                HAVING COUNT(*) FILTER (WHERE status <> 'DONE') > 0
                ORDER BY delayed_tasks DESC, nearest_due NULLS LAST
                """, companyId);
        result.put("projects", projects);

        // ② 열린 업무 전체 — 마감일 순 (대표: 누가 뭘 언제까지)
        List<Map<String, Object>> tasks = jdbcTemplate.queryForList("""
                SELECT id, project_name, task_name, assignee_name, status, priority, progress_rate, source_type,
                       due_date,
                       CASE WHEN due_date IS NULL THEN NULL ELSE (due_date - CURRENT_DATE) END AS dday,
                       blocker_text
                FROM executive_work_task
                WHERE company_id = ? AND status <> 'DONE'
                ORDER BY due_date NULLS LAST,
                         CASE status WHEN 'DELAYED' THEN 1 WHEN 'BLOCKED' THEN 2 ELSE 3 END,
                         id DESC
                """, companyId);
        result.put("tasks", tasks);

        // ③ 개인별 현황
        List<Map<String, Object>> people = jdbcTemplate.queryForList("""
                SELECT assignee_name,
                       COUNT(*)::int AS open_tasks,
                       COUNT(*) FILTER (WHERE status IN ('DELAYED','BLOCKED') OR (due_date IS NOT NULL AND due_date < CURRENT_DATE))::int AS delayed_tasks,
                       COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::int AS due_soon,
                       MIN(due_date) FILTER (WHERE due_date >= CURRENT_DATE) AS next_due
                FROM executive_work_task
                WHERE company_id = ? AND status <> 'DONE'
                GROUP BY assignee_name
                ORDER BY delayed_tasks DESC, due_soon DESC, assignee_name
                """, companyId);
        result.put("people", people);

        // ④ 재발주 시점 — 발주 데드라인 = 오늘 + 소진 D-day − 리드타임
        List<Map<String, Object>> reorder = jdbcTemplate.queryForList("""
                WITH out_stats AS (
                    SELECT product_id,
                           COALESCE(SUM(outbound_count) FILTER (WHERE outbound_date >= CURRENT_DATE - INTERVAL '6 day'), 0)::int AS out_7d,
                           COALESCE(SUM(outbound_count) FILTER (WHERE outbound_date >= CURRENT_DATE - INTERVAL '29 day'), 0)::int AS out_30d
                    FROM product_outbound
                    WHERE company_id = ?
                    GROUP BY product_id
                ),
                calc AS (
                    SELECT p.id AS product_id, p.product_name,
                           COALESCE(p.real_stock, 0) AS real_stock,
                           COALESCE(p.reorder_lead_days, 14) AS lead_days,
                           GREATEST(COALESCE(o.out_7d, 0) / 7.0, COALESCE(o.out_30d, 0) / 30.0) AS daily_burn
                    FROM product p
                    LEFT JOIN out_stats o ON o.product_id = p.id
                    WHERE p.company_id = ?
                )
                SELECT product_id, product_name, real_stock, lead_days,
                       ROUND(daily_burn::numeric, 1) AS daily_burn,
                       CASE WHEN daily_burn > 0 THEN FLOOR(real_stock / daily_burn)::int ELSE NULL END AS days_left,
                       CASE WHEN daily_burn > 0 THEN (CURRENT_DATE + FLOOR(real_stock / daily_burn)::int - lead_days) ELSE NULL END AS order_deadline,
                       CASE
                           WHEN real_stock <= 0 THEN 'OUT'
                           WHEN daily_burn = 0 THEN 'STALE'
                           WHEN (FLOOR(real_stock / daily_burn)::int - lead_days) <= 0 THEN 'ORDER_NOW'
                           WHEN (FLOOR(real_stock / daily_burn)::int - lead_days) <= 7 THEN 'ORDER_SOON'
                           ELSE 'OK'
                       END AS reorder_status
                FROM calc
                WHERE real_stock <= 0 OR daily_burn > 0
                ORDER BY CASE
                           WHEN real_stock <= 0 THEN 0
                           WHEN daily_burn > 0 AND (FLOOR(real_stock / daily_burn)::int - lead_days) <= 0 THEN 1
                           WHEN daily_burn > 0 AND (FLOOR(real_stock / daily_burn)::int - lead_days) <= 7 THEN 2
                           ELSE 3
                         END,
                         days_left NULLS LAST
                LIMIT 40
                """, companyId, companyId);
        result.put("reorder", reorder);

        return result;
    }

    /** 주간 업무 캘린더 — 일일보고 + 마감 업무를 주 단위로, 담당자별 이번 주 할 일 자동 구성 */
    public Map<String, Object> getWeekPlan(Long companyId, String weekStartStr) {
        java.time.LocalDate weekStart;
        try {
            weekStart = java.time.LocalDate.parse(String.valueOf(weekStartStr).substring(0, 10));
        } catch (Exception e) {
            weekStart = java.time.LocalDate.now();
        }
        weekStart = weekStart.with(java.time.DayOfWeek.MONDAY);
        java.time.LocalDate weekEnd = weekStart.plusDays(6);

        // ① 이번 주 일일보고 (캘린더 표시)
        List<Map<String, Object>> reports = jdbcTemplate.queryForList("""
                SELECT report_date, username, COALESCE(display_name, username) AS display_name, title
                FROM staff_work_report
                WHERE company_id = ? AND report_type = 'DAILY' AND report_date BETWEEN ? AND ?
                ORDER BY report_date, display_name
                """, companyId, java.sql.Date.valueOf(weekStart), java.sql.Date.valueOf(weekEnd));

        // ② 이번 주 마감 업무 (완료 포함 — 상태로 구분)
        List<Map<String, Object>> tasks = jdbcTemplate.queryForList("""
                SELECT id, task_name, project_name, assignee_name, status, progress_rate, due_date,
                       (status <> 'DONE' AND due_date < CURRENT_DATE) AS overdue
                FROM executive_work_task
                WHERE company_id = ? AND due_date BETWEEN ? AND ?
                ORDER BY due_date, assignee_name
                """, companyId, java.sql.Date.valueOf(weekStart), java.sql.Date.valueOf(weekEnd));

        // ③ 이번 주 이전에 마감을 넘긴 미완료 업무 (이월 할 일)
        List<Map<String, Object>> carryOver = jdbcTemplate.queryForList("""
                SELECT id, task_name, project_name, assignee_name, status, due_date
                FROM executive_work_task
                WHERE company_id = ? AND status <> 'DONE' AND due_date IS NOT NULL AND due_date < ?
                ORDER BY due_date
                LIMIT 40
                """, companyId, java.sql.Date.valueOf(weekStart));

        // ④ 담당자별 최신 일일보고의 '다음 액션' (이번 주 할 일 자동 구성 근거)
        List<Map<String, Object>> plans = jdbcTemplate.queryForList("""
                SELECT DISTINCT ON (username)
                       username, COALESCE(display_name, username) AS display_name,
                       report_date, planned_work, blockers
                FROM staff_work_report
                WHERE company_id = ? AND report_type = 'DAILY'
                  AND report_date BETWEEN ? AND ?
                ORDER BY username, report_date DESC, id DESC
                """, companyId, java.sql.Date.valueOf(weekStart.minusDays(7)), java.sql.Date.valueOf(weekEnd));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("weekStart", weekStart.toString());
        result.put("weekEnd", weekEnd.toString());
        result.put("reports", reports);
        result.put("tasks", tasks);
        result.put("carryOver", carryOver);
        result.put("plans", plans);
        return result;
    }

    @Transactional
    public Map<String, Object> saveLeadDays(Long companyId, long productId, int days) {
        int d = Math.max(0, Math.min(days, 365));
        int n = jdbcTemplate.update(
                "UPDATE product SET reorder_lead_days = ? WHERE company_id = ? AND id = ?",
                d, companyId, productId);
        return Map.of("success", n > 0, "leadDays", d);
    }

    /** 빠른 업무 추가 — 업무명·프로젝트·담당자·마감일만 받고 나머지는 기본값 */
    @Transactional
    public Map<String, Object> createTask(Long companyId, Map<String, Object> p) {
        String taskName = str(p.get("taskName"));
        if (taskName == null) return Map.of("success", false, "message", "업무명이 필요합니다.");
        String projectName = str(p.get("projectName")) == null ? "일반 업무" : str(p.get("projectName"));
        String assignee = str(p.get("assigneeName")) == null ? "미지정" : str(p.get("assigneeName"));
        java.sql.Date due = parseDate(str(p.get("dueDate")));
        jdbcTemplate.update("""
                INSERT INTO executive_work_task
                    (company_id, project_name, task_name, assignee_name, status, priority, progress_rate,
                     start_date, due_date, source_type, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'IN_PROGRESS', 'MEDIUM', 0, CURRENT_DATE, ?, 'CONTROL_TOWER', NOW(), NOW())
                """, companyId, projectName, taskName, assignee, due);
        return Map.of("success", true);
    }

    /** 업무 삭제 — 잘못 등록된 항목(주간보고 자동 등록 오추출 등) 정리용 */
    public Map<String, Object> deleteTask(Long companyId, Long id) {
        int deleted = jdbcTemplate.update(
                "DELETE FROM executive_work_task WHERE id = ? AND company_id = ?", id, companyId);
        return deleted > 0 ? Map.of("success", true) : Map.of("success", false, "message", "업무를 찾지 못했습니다.");
    }

    /** 인라인 수정 — 넘어온 필드만 반영. 완료 처리 시 completed_date 기록. */
    @Transactional
    public Map<String, Object> updateTask(Long companyId, long taskId, Map<String, Object> p) {
        StringBuilder sql = new StringBuilder("UPDATE executive_work_task SET updated_at = NOW()");
        java.util.List<Object> args = new java.util.ArrayList<>();
        if (p.containsKey("status")) {
            String status = str(p.get("status"));
            if (status != null && java.util.Set.of("WAITING", "IN_PROGRESS", "REVIEW", "DELAYED", "BLOCKED", "DONE").contains(status)) {
                sql.append(", status = ?");
                args.add(status);
                if ("DONE".equals(status)) sql.append(", completed_date = CURRENT_DATE, progress_rate = 100");
            }
        }
        if (p.containsKey("progressRate")) {
            int rate = (int) Math.max(0, Math.min(100, num(p.get("progressRate"))));
            sql.append(", progress_rate = ?");
            args.add(rate);
        }
        if (p.containsKey("dueDate")) {
            sql.append(", due_date = ?");
            args.add(parseDate(str(p.get("dueDate"))));
        }
        if (p.containsKey("taskName") && str(p.get("taskName")) != null) {
            sql.append(", task_name = ?");
            args.add(str(p.get("taskName")));
        }
        if (p.containsKey("assigneeName") && str(p.get("assigneeName")) != null) {
            sql.append(", assignee_name = ?");
            args.add(str(p.get("assigneeName")));
        }
        if (args.isEmpty() && !sql.toString().contains("completed_date")) {
            return Map.of("success", false, "message", "변경할 항목이 없습니다.");
        }
        sql.append(" WHERE company_id = ? AND id = ?");
        args.add(companyId);
        args.add(taskId);
        int n = jdbcTemplate.update(sql.toString(), args.toArray());
        return Map.of("success", n > 0);
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static long num(Object v) {
        try { return Math.round(Double.parseDouble(String.valueOf(v).replaceAll("[^0-9.-]", ""))); }
        catch (Exception e) { return 0L; }
    }

    private static java.sql.Date parseDate(String v) {
        if (v == null) return null;
        try { return java.sql.Date.valueOf(java.time.LocalDate.parse(v.substring(0, 10))); }
        catch (Exception e) { return null; }
    }
}
