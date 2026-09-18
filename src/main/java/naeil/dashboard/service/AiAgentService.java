package naeil.dashboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.entity.AiProviderSetting;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 대시보드 AI 비서 — Gemini 함수호출(에이전트) 경로.
 * 모델이 필요할 때 회사 데이터 도구를 직접 호출하고, 구글 검색 그라운딩으로 웹 정보를 조회한다.
 * 권한(대표/직원)은 서버가 강제한다. 모델의 자율 판단에 맡기지 않는다.
 * 실패 시 상위(AiChatService)에서 기존 단발 응답으로 폴백된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiAgentService {

    private static final int MAX_ITERS = 6;
    private static final int MAX_HISTORY = 6;
    private static final String GEMINI_URL_PREFIX = "https://generativelanguage.googleapis.com/v1beta/models/";

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    /** 대표 전용 도구 — 직원이 호출하면 서버가 거부한다. */
    private static final List<String> EXECUTIVE_ONLY = List.of(
            "get_sales_summary", "get_cash_balance", "get_marketing_projects");

    /**
     * 에이전트 루프 실행. 웹검색+함수 조합 거부(400) 시 웹검색을 빼고 1회 재시도한다.
     * 그래도 실패하면 예외를 던져 상위에서 단발 응답으로 폴백하게 한다.
     */
    public String run(AiProviderSetting setting, String model, String systemPrompt,
                      List<Map<String, Object>> history, String message,
                      Long companyId, boolean executive) throws Exception {
        try {
            return loop(setting, model, systemPrompt, history, message, companyId, executive, true);
        } catch (ToolComboUnsupported e) {
            log.info("Gemini 웹검색+함수 조합 미지원 → 웹검색 빼고 재시도");
            return loop(setting, model, systemPrompt, history, message, companyId, executive, false);
        }
    }

    private String loop(AiProviderSetting setting, String model, String systemPrompt,
                        List<Map<String, Object>> history, String message,
                        Long companyId, boolean executive, boolean webSearch) throws Exception {
        List<Map<String, Object>> contents = new ArrayList<>();
        if (history != null && !history.isEmpty()) {
            int from = Math.max(0, history.size() - MAX_HISTORY);
            for (int i = from; i < history.size(); i++) {
                Map<String, Object> h = history.get(i);
                String content = h.get("content") == null ? "" : String.valueOf(h.get("content"));
                if (content.isBlank()) continue;
                String role = "user".equalsIgnoreCase(String.valueOf(h.get("role"))) ? "user" : "model";
                contents.add(Map.of("role", role, "parts", List.of(Map.of("text", trim(content, 1500)))));
            }
        }
        contents.add(turn("user", trim(message, 4000)));

        String encodedModel = URLEncoder.encode(model, StandardCharsets.UTF_8).replace("+", "%20");
        URI uri = URI.create(GEMINI_URL_PREFIX + encodedModel + ":generateContent");
        List<Map<String, Object>> tools = buildTools(webSearch);

        for (int iter = 0; iter < MAX_ITERS; iter++) {
            boolean lastIter = iter == MAX_ITERS - 1;
            JsonNode root = post(setting, uri, body(systemPrompt, contents, lastIter ? null : tools));
            JsonNode parts = root.path("candidates").path(0).path("content").path("parts");

            List<JsonNode> calls = new ArrayList<>();
            StringBuilder text = new StringBuilder();
            for (JsonNode p : parts) {
                if (p.has("functionCall")) calls.add(p.get("functionCall"));
                else if (p.has("text")) text.append(p.path("text").asText());
            }

            if (calls.isEmpty() || lastIter) {
                String answer = text.toString().trim();
                if (!answer.isEmpty()) return answer;
                if (lastIter) return "요청을 처리하지 못했습니다. 질문을 조금 더 구체적으로 다시 물어봐 주세요.";
                // 텍스트도 함수도 없으면 한 번 더 돈다.
            }
            if (calls.isEmpty()) continue;

            // 모델이 요청한 함수호출을 대화에 반영
            List<Map<String, Object>> modelParts = new ArrayList<>();
            for (JsonNode c : calls) {
                Map<String, Object> fc = new LinkedHashMap<>();
                fc.put("name", c.path("name").asText());
                fc.put("args", asMap(c.path("args")));
                modelParts.add(Map.of("functionCall", fc));
            }
            contents.add(Map.of("role", "model", "parts", modelParts));

            // 도구 실행 + 결과 반환
            List<Map<String, Object>> respParts = new ArrayList<>();
            for (JsonNode c : calls) {
                String name = c.path("name").asText();
                String result = executeTool(name, asMap(c.path("args")), companyId, executive);
                respParts.add(Map.of("functionResponse", Map.of(
                        "name", name,
                        "response", Map.of("result", trim(result, 6000))
                )));
            }
            contents.add(Map.of("role", "user", "parts", respParts));
        }
        return "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
    }

    /* ───────── 요청 본문 ───────── */

    private Map<String, Object> body(String systemPrompt, List<Map<String, Object>> contents,
                                     List<Map<String, Object>> tools) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("system_instruction", Map.of("parts", List.of(Map.of("text", systemPrompt))));
        body.put("contents", contents);
        if (tools != null && !tools.isEmpty()) body.put("tools", tools);
        // 데이터 조회 비서라 thinking 불필요(지연만 유발). 도구 호출에는 영향 없음.
        body.put("generationConfig", Map.of(
                "maxOutputTokens", 2048,
                "thinkingConfig", Map.of("thinkingBudget", 0)
        ));
        return body;
    }

    private List<Map<String, Object>> buildTools(boolean webSearch) {
        List<Map<String, Object>> tools = new ArrayList<>();
        tools.add(Map.of("functionDeclarations", functionDeclarations()));
        if (webSearch) tools.add(Map.of("googleSearch", Map.of()));
        return tools;
    }

    private List<Map<String, Object>> functionDeclarations() {
        Map<String, Object> objEmpty = Map.of("type", "OBJECT", "properties", Map.of());
        return List.of(
                decl("get_sales_summary", "이번 달·오늘 매출과 채널별 매출을 조회한다. (대표 전용)", objEmpty),
                decl("get_cash_balance", "회사의 현재 현금 잔액을 조회한다. (대표 전용)", objEmpty),
                decl("get_marketing_projects", "기획·진행중인 마케팅 프로젝트를 조회한다. (대표 전용)", objEmpty),
                decl("get_open_tasks", "진행중(미완료)인 업무 목록을 조회한다.", objEmpty),
                decl("get_recent_orders", "최근 발주와 입고 예정 내역을 조회한다.", objEmpty),
                decl("get_recent_reports",
                        "최근 N일간의 일일 업무보고를 조회한다(열람 권한 범위 내). 기본 7일.",
                        Map.of("type", "OBJECT", "properties", Map.of(
                                "days", Map.of("type", "INTEGER", "description", "조회 일수(기본 7)"))))
        );
    }

    private Map<String, Object> decl(String name, String desc, Map<String, Object> params) {
        return Map.of("name", name, "description", desc, "parameters", params);
    }

    /* ───────── 도구 실행 (권한 서버 강제) ───────── */

    private String executeTool(String name, Map<String, Object> args, Long companyId, boolean executive) {
        try {
            if (EXECUTIVE_ONLY.contains(name) && !executive) {
                return "권한 없음: 이 정보는 대표 전용입니다. 사용자에게 '대표 권한 정보라 답할 수 없습니다'라고 안내하세요.";
            }
            return switch (name) {
                case "get_sales_summary" -> toolSales(companyId);
                case "get_cash_balance" -> toolCash(companyId);
                case "get_marketing_projects" -> toolPromos(companyId);
                case "get_open_tasks" -> toolTasks(companyId);
                case "get_recent_orders" -> toolOrders(companyId);
                case "get_recent_reports" -> toolReports(companyId, args);
                default -> "알 수 없는 도구입니다: " + name;
            };
        } catch (Exception e) {
            log.debug("도구 실행 실패({}): {}", name, e.getMessage());
            return "도구 실행 중 오류가 발생했습니다: " + trim(String.valueOf(e.getMessage()), 120);
        }
    }

    private String toolSales(Long companyId) {
        Map<String, Object> month = jdbcTemplate.queryForMap("""
                SELECT COALESCE(SUM(COALESCE(o.pay_amt,0) - COALESCE(o.cancel_amt,0)),0) AS sales, COUNT(*) AS cnt
                FROM orders o
                WHERE o.company_id = ?
                  AND COALESCE(o.pay_time, o.ord_time, o.wdate)::date >= date_trunc('month', CURRENT_DATE)::date
                """, companyId);
        Map<String, Object> today = jdbcTemplate.queryForMap("""
                SELECT COALESCE(SUM(COALESCE(o.pay_amt,0) - COALESCE(o.cancel_amt,0)),0) AS sales, COUNT(*) AS cnt
                FROM orders o
                WHERE o.company_id = ?
                  AND COALESCE(o.pay_time, o.ord_time, o.wdate)::date = CURRENT_DATE
                """, companyId);
        StringBuilder sb = new StringBuilder();
        sb.append("이번 달 매출 ").append(won(month.get("sales"))).append(" (").append(month.get("cnt")).append("건)\n");
        sb.append("오늘 매출 ").append(won(today.get("sales"))).append(" (").append(today.get("cnt")).append("건)\n");
        List<Map<String, Object>> byChannel = jdbcTemplate.queryForList("""
                SELECT s.shop_name, COALESCE(SUM(COALESCE(o.pay_amt,0) - COALESCE(o.cancel_amt,0)),0) AS sales
                FROM orders o JOIN shop s ON s.id = o.shop_id
                WHERE o.company_id = ?
                  AND COALESCE(o.pay_time, o.ord_time, o.wdate)::date >= date_trunc('month', CURRENT_DATE)::date
                GROUP BY s.shop_name ORDER BY sales DESC LIMIT 8
                """, companyId);
        sb.append("채널별(이번 달):\n");
        for (Map<String, Object> r : byChannel) {
            sb.append("- ").append(r.get("shop_name")).append(": ").append(won(r.get("sales"))).append("\n");
        }
        return sb.toString();
    }

    private String toolCash(Long companyId) {
        Object balance = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(balance),0) FROM executive_cash_account WHERE company_id = ?",
                Object.class, companyId);
        return "현재 현금 잔액 " + won(balance);
    }

    private String toolTasks(Long companyId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT task_name, COALESCE(assignee_name,'미지정') AS assignee, status,
                       COALESCE(progress_rate,0) AS progress, due_date
                FROM executive_work_task
                WHERE company_id = ? AND status NOT IN ('DONE')
                ORDER BY due_date NULLS LAST, id DESC
                LIMIT 20
                """, companyId);
        if (rows.isEmpty()) return "진행중인 업무가 없습니다.";
        StringBuilder sb = new StringBuilder("진행중 업무 " + rows.size() + "건:\n");
        for (Map<String, Object> r : rows) {
            sb.append("- ").append(trim(String.valueOf(r.get("task_name")), 50))
                    .append(" | 담당 ").append(r.get("assignee"))
                    .append(" | ").append(r.get("status")).append(" ").append(r.get("progress")).append("%")
                    .append(r.get("due_date") == null ? "" : " | 마감 " + r.get("due_date"))
                    .append("\n");
        }
        return sb.toString();
    }

    private String toolOrders(Long companyId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT COALESCE(s.supplier_name,'미지정') AS supplier, po.order_type, po.status,
                       po.order_date, po.expected_date,
                       COALESCE((SELECT SUM(i.amount) FROM purchase_order_item i WHERE i.po_id = po.id), 0) AS amount
                FROM purchase_order po
                LEFT JOIN supplier s ON s.id = po.supplier_id
                WHERE po.company_id = ?
                ORDER BY po.order_date DESC, po.id DESC
                LIMIT 15
                """, companyId);
        if (rows.isEmpty()) return "최근 발주 내역이 없습니다.";
        StringBuilder sb = new StringBuilder("최근 발주 " + rows.size() + "건:\n");
        for (Map<String, Object> r : rows) {
            sb.append("- ").append(r.get("supplier"))
                    .append(" | ").append(r.get("order_type")).append("/").append(r.get("status"))
                    .append(" | 발주 ").append(r.get("order_date"))
                    .append(r.get("expected_date") == null ? "" : " → 입고예정 " + r.get("expected_date"))
                    .append(" | ").append(won(r.get("amount"))).append("\n");
        }
        return sb.toString();
    }

    private String toolPromos(Long companyId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT title, brand_name, channel_name, status, start_date, end_date, is_always_on
                FROM promo_event
                WHERE company_id = ? AND status IN ('기획','진행중')
                ORDER BY start_date DESC LIMIT 15
                """, companyId);
        if (rows.isEmpty()) return "기획·진행중인 마케팅 프로젝트가 없습니다.";
        StringBuilder sb = new StringBuilder("마케팅 프로젝트 " + rows.size() + "건:\n");
        for (Map<String, Object> r : rows) {
            sb.append("- ").append(trim(String.valueOf(r.get("title")), 40))
                    .append(" | ").append(r.get("brand_name")).append("/").append(r.get("channel_name"))
                    .append(" | ").append(r.get("status"))
                    .append(" | ").append(r.get("start_date")).append("~")
                    .append(Boolean.TRUE.equals(r.get("is_always_on")) ? "상시" : r.get("end_date"))
                    .append("\n");
        }
        return sb.toString();
    }

    private String toolReports(Long companyId, Map<String, Object> args) {
        int days = 7;
        try {
            Object d = args == null ? null : args.get("days");
            if (d != null) days = Math.max(1, Math.min(31, (int) Math.round(Double.parseDouble(String.valueOf(d)))));
        } catch (Exception ignore) { /* 기본 7 */ }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT COALESCE(display_name, username) AS name, report_date, title,
                       completed_work, planned_work, blockers
                FROM staff_work_report
                WHERE company_id = ? AND report_type = 'DAILY' AND report_date >= CURRENT_DATE - (? || ' days')::interval
                ORDER BY report_date DESC, username LIMIT 25
                """, companyId, days);
        if (rows.isEmpty()) return "최근 " + days + "일간 일일 보고가 없습니다.";
        StringBuilder sb = new StringBuilder("최근 " + days + "일 일일 보고 " + rows.size() + "건:\n");
        for (Map<String, Object> r : rows) {
            sb.append("- [").append(r.get("report_date")).append("] ").append(r.get("name"))
                    .append(": ").append(trim(String.valueOf(r.get("title")), 50)).append("\n");
            appendIf(sb, "  완료: ", r.get("completed_work"));
            appendIf(sb, "  다음: ", r.get("planned_work"));
            appendIf(sb, "  막힘: ", r.get("blockers"));
        }
        return sb.toString();
    }

    /* ───────── HTTP ───────── */

    private JsonNode post(AiProviderSetting setting, URI uri, Map<String, Object> body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(uri)
                .timeout(Duration.ofSeconds(120))
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", setting.getApiKey().trim())
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        int code = response.statusCode();
        if (code < 200 || code >= 300) {
            String b = response.body() == null ? "" : response.body();
            String lb = b.toLowerCase();
            // 웹검색 그라운딩과 함수선언 동시 사용을 모델이 거부하는 경우 → 상위에서 웹검색 빼고 재시도
            if (code == 400 && (lb.contains("google_search") || lb.contains("googlesearch")
                    || (lb.contains("tool") && lb.contains("function")))) {
                throw new ToolComboUnsupported();
            }
            throw new RuntimeException("Gemini API 오류: " + code + " " + trim(b.replaceAll("\\s+", " "), 400));
        }
        return objectMapper.readTree(response.body());
    }

    /* ───────── 유틸 ───────── */

    private static Map<String, Object> turn(String role, String text) {
        return Map.of("role", role, "parts", List.of(Map.of("text", text)));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return Map.of();
        return objectMapper.convertValue(node, Map.class);
    }

    private static void appendIf(StringBuilder sb, String label, Object value) {
        if (value == null) return;
        String text = value.toString().trim();
        if (text.isEmpty()) return;
        sb.append(label).append(trim(text.replace("\n", " / "), 160)).append("\n");
    }

    private static String trim(String text, int max) {
        if (text == null) return "";
        return text.length() <= max ? text : text.substring(0, max) + "…";
    }

    private static String won(Object value) {
        try {
            long v = Math.round(Double.parseDouble(String.valueOf(value)));
            return String.format("%,d원", v);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }

    /** 웹검색+함수 조합 미지원 신호(내부용). */
    private static class ToolComboUnsupported extends RuntimeException {
    }
}
