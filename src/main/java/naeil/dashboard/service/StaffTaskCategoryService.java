package naeil.dashboard.service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class StaffTaskCategoryService {

    private final JdbcTemplate jdbcTemplate;

    public List<Map<String, Object>> listCategories(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT *
                FROM staff_task_category
                WHERE company_id = ?
                ORDER BY sort_order, id
                """, companyId);
    }

    public Map<String, Object> createCategory(Long companyId, AuthUser user, Map<String, Object> payload) {
        String name = required(payload.get("name"), "카테고리명을 입력하세요.");
        String color = stringValue(payload.get("color"), "#ff5a3d");
        Integer sortOrder = toInt(payload.get("sort_order"), nextSortOrder(companyId));

        try {
            jdbcTemplate.update("""
                    INSERT INTO staff_task_category (
                        company_id, name, color, template_project_name, template_task_name,
                        template_today_work, template_next_action, template_blocker_text,
                        sort_order, created_by
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    companyId,
                    name,
                    color,
                    blankToNull(payload.get("template_project_name")),
                    blankToNull(payload.get("template_task_name")),
                    blankToNull(payload.get("template_today_work")),
                    blankToNull(payload.get("template_next_action")),
                    blankToNull(payload.get("template_blocker_text")),
                    sortOrder,
                    user == null ? null : user.username()
            );
        } catch (DuplicateKeyException exception) {
            throw new CustomException(409, "이미 같은 이름의 카테고리가 있습니다.");
        }

        Long id = jdbcTemplate.queryForObject("""
                SELECT id
                FROM staff_task_category
                WHERE company_id = ? AND name = ?
                ORDER BY id DESC
                LIMIT 1
                """, Long.class, companyId, name);
        return getCategory(id);
    }

    public Map<String, Object> updateCategory(Long id, Map<String, Object> payload) {
        Map<String, Object> values = new HashMap<>();
        putIfPresent(values, "name", blankToNull(payload.get("name")));
        putIfPresent(values, "color", blankToNull(payload.get("color")));
        putIfPresent(values, "template_project_name", blankToNull(payload.get("template_project_name")));
        putIfPresent(values, "template_task_name", blankToNull(payload.get("template_task_name")));
        putIfPresent(values, "template_today_work", blankToNull(payload.get("template_today_work")));
        putIfPresent(values, "template_next_action", blankToNull(payload.get("template_next_action")));
        putIfPresent(values, "template_blocker_text", blankToNull(payload.get("template_blocker_text")));
        if (payload.containsKey("sort_order")) {
            values.put("sort_order", toInt(payload.get("sort_order"), 0));
        }

        if (values.isEmpty()) {
            return getCategory(id);
        }

        values.put("updated_at", OffsetDateTime.now());
        List<String> columns = values.keySet().stream().toList();
        String setSql = String.join(", ", columns.stream().map(column -> column + " = ?").toList());
        List<Object> params = new ArrayList<>(columns.stream().map(values::get).toList());
        params.add(id);

        try {
            int updated = jdbcTemplate.update("UPDATE staff_task_category SET " + setSql + " WHERE id = ?", params.toArray());
            if (updated == 0) {
                throw new CustomException(404, "카테고리를 찾을 수 없습니다.");
            }
        } catch (DuplicateKeyException exception) {
            throw new CustomException(409, "이미 같은 이름의 카테고리가 있습니다.");
        }
        return getCategory(id);
    }

    public void deleteCategory(Long id) {
        int deleted = jdbcTemplate.update("DELETE FROM staff_task_category WHERE id = ?", id);
        if (deleted == 0) {
            throw new CustomException(404, "카테고리를 찾을 수 없습니다.");
        }
    }

    private Map<String, Object> getCategory(Long id) {
        return jdbcTemplate.queryForMap("SELECT * FROM staff_task_category WHERE id = ?", id);
    }

    private Integer nextSortOrder(Long companyId) {
        Integer max = jdbcTemplate.queryForObject(
                "SELECT COALESCE(MAX(sort_order), 0) + 10 FROM staff_task_category WHERE company_id = ?",
                Integer.class,
                companyId
        );
        return max == null ? 10 : max;
    }

    private static void putIfPresent(Map<String, Object> values, String key, Object value) {
        if (value != null) {
            values.put(key, value);
        }
    }

    private static String required(Object value, String message) {
        String text = blankToNull(value);
        if (text == null) {
            throw new CustomException(400, message);
        }
        return text;
    }

    private static String stringValue(Object value, String fallback) {
        return value == null || value.toString().isBlank() ? fallback : value.toString().trim();
    }

    private static String blankToNull(Object value) {
        if (value == null) return null;
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private static Integer toInt(Object value, Integer fallback) {
        if (value == null || value.toString().isBlank()) return fallback;
        if (value instanceof Number number) return number.intValue();
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }
}
