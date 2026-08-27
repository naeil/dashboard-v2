package naeil.dashboard.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import naeil.dashboard.entity.AiProviderSetting;
import naeil.dashboard.enums.AiProvider;
import naeil.dashboard.repository.AiProviderSettingRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 대시보드 AI 비서 — 로그인한 사용자의 권한 범위 안의 실데이터를 컨텍스트로 넣어 답한다.
 * 대표(EXECUTIVE): 매출·현금·업무·보고·발주 전부 / 직원: 본인·열람권한 보고 + 공용 업무·발주만.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiChatService {

    private static final int MAX_HISTORY = 6;

    private volatile String cachedModel;
    private volatile AiProvider cachedModelProvider;
    private volatile long cachedModelAt;

    private final JdbcTemplate jdbcTemplate;
    private final AiApiClient aiApiClient;
    private final AiProviderSettingRepository aiProviderSettingRepository;
    private final AiProviderSettingService aiProviderSettingService;

    public Map<String, Object> chat(Long companyId, AuthUser user, String message, List<Map<String, Object>> history) {
        if (message == null || message.isBlank()) {
            return Map.of("success", false, "message", "질문을 입력해 주세요.");
        }
        AiProviderSetting setting = firstActiveSetting(companyId);
        if (setting == null) {
            return Map.of("success", false, "message", "활성화된 AI 인증 정보가 없습니다. [시스템 > AI 설정]에서 등록하세요.");
        }
        boolean executive = UserRole.from(user.role()) == UserRole.EXECUTIVE;
        String model = resolveModel(companyId, setting.getProvider());
        String systemPrompt = buildSystemPrompt(companyId, user, executive, message);
        String userMessage = buildUserMessage(history, message);
        try {
            String answer = aiApiClient.complete(setting, model, systemPrompt, userMessage);
            return Map.of("success", true, "answer", answer == null ? "" : answer.trim(), "model", model);
        } catch (Exception e) {
            log.warn("AI 챗 실패: {}", e.getMessage());
            String msg = String.valueOf(e.getMessage());
            if (msg.contains("429") || msg.toLowerCase().contains("quota") || msg.toLowerCase().contains("rate")) {
                return Map.of("success", false, "message", "AI 사용량 한도에 걸렸습니다. 잠시 후 다시 시도하거나 유료 키 등록을 검토하세요.");
            }
            return Map.of("success", false, "message", "AI 응답에 실패했습니다: " + trim(msg, 160));
        }
    }

    /* ───────── 프롬프트 구성 ───────── */

    private String buildSystemPrompt(Long companyId, AuthUser user, boolean executive, String question) {
        StringBuilder sb = new StringBuilder();
        sb.append("""
                너는 주식회사 내일그룹의 대시보드 AI 비서다. 아래 [데이터]는 지금 이 순간 대시보드에서 조회한 실데이터다.

                규칙:
                - [데이터]에 있는 내용만 근거로 답한다. 없는 수치는 지어내지 않고 "대시보드에서 확인이 필요합니다"라고 말한다.
                - 한국어, 간결한 개조식 또는 2~4문장. 숫자는 원 단위 콤마 표기.
                - 판단을 물으면 데이터 근거를 한 줄 붙여서 답한다.
                - 오늘 날짜: %s
                """.formatted(LocalDate.now()));
        if (!executive) {
            sb.append("- 이 사용자는 직원이다. 매출·현금·이익·성과급 등 경영 수치는 권한 밖이므로 [데이터]에 없다. "
                    + "물어보면 \"대표 권한 정보라 답할 수 없습니다\"라고 답한다.\n");
        }
        sb.append("\n[사용자] ").append(user.displayName() == null ? user.username() : user.displayName())
                .append(" (").append(executive ? "대표" : "직원").append(")\n");

        sb.append("\n[데이터]\n");
        appendTasks(sb, companyId);
        appendReports(sb, companyId, user, executive);
        appendOrders(sb, companyId);
        if (executive) {
            appendSales(sb, companyId);
            appendCash(sb, companyId);
            if (matches(question, "행사", "프로모션", "마케팅")) appendPromos(sb, companyId);
        }
        return sb.toString();
    }

    private void appendTasks(StringBuilder sb, Long companyId) {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                    SELECT task_name, COALESCE(assignee_name,'미지정') AS assignee, status,
                           COALESCE(progress_rate,0) AS progress, due_date
                    FROM executive_work_task
                    WHERE company_id = ? AND status NOT IN ('DONE')
                    ORDER BY due_date NULLS LAST, id DESC
                    LIMIT 12
                    """, companyId);
            sb.append("\n## 진행중 업무 (종합 상황판, ").append(rows.size()).append("건 표시)\n");
            for (Map<String, Object> r : rows) {
                sb.append("- ").append(trim(String.valueOf(r.get("task_name")), 40))
                        .append(" | 담당 ").append(r.get("assignee"))
                        .append(" | ").append(r.get("status"))
                        .append(" ").append(r.get("progress")).append("%")
                        .append(r.get("due_date") == null ? "" : " | 마감 " + r.get("due_date"))
                        .append("\n");
            }
        } catch (Exception e) {
            log.debug("tasks context 실패: {}", e.getMessage());
        }
    }

    private void appendReports(StringBuilder sb, Long companyId, AuthUser user, boolean executive) {
        try {
            List<Map<String, Object>> rows;
            String base = """
                    SELECT COALESCE(display_name, username) AS name, report_date, title,
                           completed_work, planned_work, blockers
                    FROM staff_work_report
                    WHERE company_id = ? AND report_type = 'DAILY' AND report_date >= CURRENT_DATE - 7
                    """;
            if (executive) {
                rows = jdbcTemplate.queryForList(base + " ORDER BY report_date DESC, username LIMIT 15", companyId);
            } else {
                rows = jdbcTemplate.queryForList(base + """
                          AND (LOWER(username) = LOWER(?)
                               OR LOWER(username) IN (
                                   SELECT LOWER(target_username) FROM report_view_permission
                                   WHERE company_id = ? AND LOWER(viewer_username) = LOWER(?)))
                        ORDER BY report_date DESC, username LIMIT 15
                        """, companyId, user.username(), companyId, user.username());
            }
            sb.append("\n## 최근 7일 일일 보고 (열람 가능 범위, ").append(rows.size()).append("건)\n");
            for (Map<String, Object> r : rows) {
                sb.append("- [").append(r.get("report_date")).append("] ").append(r.get("name"))
                        .append(": ").append(trim(String.valueOf(r.get("title")), 40)).append("\n");
                appendIf(sb, "  완료: ", r.get("completed_work"));
                appendIf(sb, "  다음: ", r.get("planned_work"));
                appendIf(sb, "  막힘: ", r.get("blockers"));
            }
        } catch (Exception e) {
            log.debug("reports context 실패: {}", e.getMessage());
        }
    }

    private void appendOrders(StringBuilder sb, Long companyId) {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                    SELECT COALESCE(s.supplier_name,'미지정') AS supplier, po.order_type, po.status,
                           po.order_date, po.expected_date,
                           COALESCE((SELECT SUM(i.amount) FROM purchase_order_item i WHERE i.po_id = po.id), 0) AS amount
                    FROM purchase_order po
                    LEFT JOIN supplier s ON s.id = po.supplier_id
                    WHERE po.company_id = ?
                    ORDER BY po.order_date DESC, po.id DESC
                    LIMIT 8
                    """, companyId);
            sb.append("\n## 최근 발주 (생산 관리, ").append(rows.size()).append("건)\n");
            for (Map<String, Object> r : rows) {
                sb.append("- ").append(r.get("supplier"))
                        .append(" | ").append(r.get("order_type")).append("/").append(r.get("status"))
                        .append(" | 발주 ").append(r.get("order_date"))
                        .append(r.get("expected_date") == null ? "" : " → 입고예정 " + r.get("expected_date"))
                        .append(" | ").append(won(r.get("amount"))).append("\n");
            }
        } catch (Exception e) {
            log.debug("orders context 실패: {}", e.getMessage());
        }
    }

    private void appendSales(StringBuilder sb, Long companyId) {
        try {
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
            sb.append("\n## 매출 (대표 전용, 직연동 실시간 기준)\n");
            sb.append("- 이번 달 매출 ").append(won(month.get("sales"))).append(" (").append(month.get("cnt")).append("건)\n");
            sb.append("- 오늘 매출 ").append(won(today.get("sales"))).append(" (").append(today.get("cnt")).append("건)\n");
            List<Map<String, Object>> byChannel = jdbcTemplate.queryForList("""
                    SELECT s.shop_name, COALESCE(SUM(COALESCE(o.pay_amt,0) - COALESCE(o.cancel_amt,0)),0) AS sales
                    FROM orders o JOIN shop s ON s.id = o.shop_id
                    WHERE o.company_id = ?
                      AND COALESCE(o.pay_time, o.ord_time, o.wdate)::date >= date_trunc('month', CURRENT_DATE)::date
                    GROUP BY s.shop_name ORDER BY sales DESC LIMIT 5
                    """, companyId);
            for (Map<String, Object> r : byChannel) {
                sb.append("- ").append(r.get("shop_name")).append(": ").append(won(r.get("sales"))).append("\n");
            }
        } catch (Exception e) {
            log.debug("sales context 실패: {}", e.getMessage());
        }
    }

    private void appendCash(StringBuilder sb, Long companyId) {
        try {
            Object balance = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(SUM(balance),0) FROM executive_cash_account WHERE company_id = ?",
                    Object.class, companyId);
            sb.append("\n## 현금 (대표 전용)\n- 현재 현금 잔액 ").append(won(balance)).append("\n");
        } catch (Exception e) {
            log.debug("cash context 실패: {}", e.getMessage());
        }
    }

    private void appendPromos(StringBuilder sb, Long companyId) {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                    SELECT title, brand_name, channel_name, status, start_date, end_date, is_always_on
                    FROM promo_event
                    WHERE company_id = ? AND status IN ('기획','진행중')
                    ORDER BY start_date DESC LIMIT 10
                    """, companyId);
            sb.append("\n## 마케팅 프로젝트 (기획·진행중, ").append(rows.size()).append("건)\n");
            for (Map<String, Object> r : rows) {
                sb.append("- ").append(trim(String.valueOf(r.get("title")), 30))
                        .append(" | ").append(r.get("brand_name")).append("/").append(r.get("channel_name"))
                        .append(" | ").append(r.get("status"))
                        .append(" | ").append(r.get("start_date")).append("~")
                        .append(Boolean.TRUE.equals(r.get("is_always_on")) ? "상시" : r.get("end_date"))
                        .append("\n");
            }
        } catch (Exception e) {
            log.debug("promo context 실패: {}", e.getMessage());
        }
    }

    private String buildUserMessage(List<Map<String, Object>> history, String message) {
        StringBuilder sb = new StringBuilder();
        if (history != null && !history.isEmpty()) {
            sb.append("[이전 대화]\n");
            int from = Math.max(0, history.size() - MAX_HISTORY);
            for (int i = from; i < history.size(); i++) {
                Map<String, Object> h = history.get(i);
                String role = "user".equalsIgnoreCase(String.valueOf(h.get("role"))) ? "사용자" : "AI";
                sb.append(role).append(": ").append(trim(String.valueOf(h.get("content")), 300)).append("\n");
            }
            sb.append("\n");
        }
        sb.append("[질문]\n").append(message.trim());
        return sb.toString();
    }

    /* ───────── 유틸 ───────── */

    private static boolean matches(String text, String... keywords) {
        if (text == null) return false;
        for (String k : keywords) if (text.contains(k)) return true;
        return false;
    }

    private static void appendIf(StringBuilder sb, String label, Object value) {
        if (value == null) return;
        String text = value.toString().trim();
        if (text.isEmpty()) return;
        sb.append(label).append(trim(text.replace("\n", " / "), 140)).append("\n");
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

    private AiProviderSetting firstActiveSetting(Long companyId) {
        return aiProviderSettingRepository.findByCompanyIdOrderByProviderAsc(companyId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .filter(s -> s.getApiKey() != null && !s.getApiKey().isBlank())
                .findFirst().orElse(null);
    }

    private String resolveModel(Long companyId, AiProvider provider) {
        if (cachedModel != null && cachedModelProvider == provider
                && System.currentTimeMillis() - cachedModelAt < 3_600_000L) {
            return cachedModel;
        }
        try {
            List<naeil.dashboard.dto.AiProviderSettingDto.ModelOption> models =
                    aiProviderSettingService.getModels(companyId, provider);
            if (models != null && !models.isEmpty()) {
                String[] prefs = switch (provider) {
                    case OPENAI -> new String[]{"mini", "gpt-4o"};
                    case CLAUDE -> new String[]{"haiku", "sonnet"};
                    case GEMINI -> new String[]{"flash", "gemini"};
                };
                for (String pref : prefs) {
                    for (var m : models) {
                        if (m.value() != null && m.value().toLowerCase().contains(pref)) return cacheModel(provider, m.value());
                    }
                }
                return cacheModel(provider, models.get(0).value());
            }
        } catch (Exception e) {
            log.warn("AI 모델 카탈로그 조회 실패({}): {}", provider, e.getMessage());
        }
        return switch (provider) {
            case OPENAI -> "gpt-4o-mini";
            case CLAUDE -> "claude-3-5-haiku-latest";
            case GEMINI -> "gemini-3.6-flash";
        };
    }

    private String cacheModel(AiProvider provider, String model) {
        cachedModel = model;
        cachedModelProvider = provider;
        cachedModelAt = System.currentTimeMillis();
        return model;
    }
}
