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
                SELECT id, project_name, task_name, assignee_name, status, priority, progress_rate,
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

    @Transactional
    public Map<String, Object> saveLeadDays(Long companyId, long productId, int days) {
        int d = Math.max(0, Math.min(days, 365));
        int n = jdbcTemplate.update(
                "UPDATE product SET reorder_lead_days = ? WHERE company_id = ? AND id = ?",
                d, companyId, productId);
        return Map.of("success", n > 0, "leadDays", d);
    }
}
