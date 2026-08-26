package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import naeil.dashboard.entity.AiProviderSetting;
import naeil.dashboard.enums.AiProvider;
import naeil.dashboard.repository.AiProviderSettingRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * AI 주간 업무 보고 — 일일 보고 7일치를 육하원칙 기준으로 인물별 자동 정리.
 * 매주 월요일 아침 자동 생성(@Scheduled) + 화면에서 수동 생성.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiWeeklyReportService {

    private static final Long COMPANY = 1L;
    private static final String SYSTEM_PROMPT = """
            너는 회사의 업무 보고 정리 비서다. 한 직원의 일주일치 일일 업무 보고를 받아 주간 업무 보고로 정리한다.

            규칙:
            - 보고에 적힌 내용만 사용한다. 없는 사실을 지어내지 않는다.
            - 간결한 한국어 개조식으로 쓴다. 과장 표현 금지.
            - 아래 형식을 그대로 따른다. 마크다운 헤더(#)는 쓰지 않는다.

            형식:
            【한 줄 요약】
            (이번 주 핵심을 1~2문장)

            【육하원칙 정리】
            - 누가: (담당자)
            - 언제: (기간과 주요 날짜)
            - 어디서: (채널·거래처·플랫폼 등 업무 무대)
            - 무엇을: (핵심 업무 3~5개)
            - 어떻게: (진행 방식·협업·수단)
            - 왜: (업무의 목적·기대 효과)

            【완료한 일】
            - (완료 항목 bullet)

            【다음 주 예정】
            - (예정 항목 bullet)

            【막힌 이슈】
            - (이슈 없으면 "없음")
            """;

    private final JdbcTemplate jdbcTemplate;
    private final AiApiClient aiApiClient;
    private final AiProviderSettingRepository aiProviderSettingRepository;
    private final AiProviderSettingService aiProviderSettingService;

    /* ───────── 생성 ───────── */

    @Transactional
    public Map<String, Object> generate(Long companyId, String weekStartStr) {
        LocalDate weekStart = resolveWeekStart(weekStartStr);
        LocalDate weekEnd = weekStart.plusDays(6);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT username, COALESCE(display_name, username) AS display_name, report_date, title,
                       completed_work, planned_work, blockers
                FROM staff_work_report
                WHERE company_id = ? AND report_type = 'DAILY' AND report_date BETWEEN ? AND ?
                ORDER BY username, report_date
                """, companyId, java.sql.Date.valueOf(weekStart), java.sql.Date.valueOf(weekEnd));
        if (rows.isEmpty()) {
            return Map.of("success", false, "message", weekStart + " 주에 일일 보고가 없습니다.");
        }

        AiProviderSetting setting = firstActiveSetting(companyId);
        if (setting == null) {
            return Map.of("success", false, "message", "활성화된 AI 인증 정보가 없습니다. [시스템 > AI 설정]에서 등록하세요.");
        }
        String model = resolveModel(companyId, setting.getProvider());

        Map<String, StringBuilder> byUser = new LinkedHashMap<>();
        Map<String, String> displayNames = new LinkedHashMap<>();
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            String username = String.valueOf(r.get("username"));
            displayNames.put(username, String.valueOf(r.get("display_name")));
            counts.merge(username, 1, Integer::sum);
            StringBuilder sb = byUser.computeIfAbsent(username, k -> new StringBuilder());
            sb.append("[").append(r.get("report_date")).append("] ").append(r.get("title")).append("\n");
            appendSection(sb, "완료/진행", r.get("completed_work"));
            appendSection(sb, "다음 액션", r.get("planned_work"));
            appendSection(sb, "막힌 이슈", r.get("blockers"));
            sb.append("\n");
        }

        int generated = 0;
        List<String> errors = new ArrayList<>();
        for (Map.Entry<String, StringBuilder> e : byUser.entrySet()) {
            String username = e.getKey();
            String name = displayNames.get(username);
            try {
                String userMessage = "직원: " + name + "\n기간: " + weekStart + " ~ " + weekEnd
                        + "\n\n일일 보고 내용:\n" + e.getValue();
                String content = aiApiClient.complete(setting, model, SYSTEM_PROMPT, userMessage);
                jdbcTemplate.update("""
                        INSERT INTO ai_weekly_report (company_id, username, display_name, week_start, content, source_count, generated_at)
                        VALUES (?, ?, ?, ?, ?, ?, NOW())
                        ON CONFLICT (company_id, username, week_start)
                        DO UPDATE SET content = EXCLUDED.content, display_name = EXCLUDED.display_name,
                                      source_count = EXCLUDED.source_count, generated_at = NOW()
                        """, companyId, username, name, java.sql.Date.valueOf(weekStart),
                        content, counts.getOrDefault(username, 0));
                generated++;
            } catch (Exception ex) {
                log.error("AI 주간 보고 생성 실패({}): {}", username, ex.getMessage());
                errors.add(name + ": " + ex.getMessage());
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", generated > 0);
        result.put("generated", generated);
        result.put("weekStart", weekStart.toString());
        result.put("errors", errors);
        return result;
    }

    /** 매주 월요일 07:30 KST(일요일 22:30 UTC) — 방금 끝난 주 자동 생성 */
    @Scheduled(cron = "0 30 22 * * SUN")
    public void generateWeeklyAuto() {
        try {
            LocalDate monday = LocalDate.now().with(DayOfWeek.MONDAY);
            Map<String, Object> result = generate(COMPANY, monday.toString());
            log.info("[AI 주간 보고 자동 생성] {}", result);
        } catch (Exception e) {
            log.warn("[AI 주간 보고 자동 생성] 실패: {}", e.getMessage());
        }
    }

    /* ───────── 조회 (열람 권한 반영) ───────── */

    public List<Map<String, Object>> list(Long companyId, AuthUser user, String weekStartStr) {
        LocalDate weekStart = weekStartStr == null || weekStartStr.isBlank() ? null : resolveWeekStart(weekStartStr);
        boolean all = UserRole.from(user.role()) == UserRole.EXECUTIVE;
        StringBuilder sql = new StringBuilder("""
                SELECT username, display_name, week_start, content, source_count, generated_at::date AS generated_date
                FROM ai_weekly_report WHERE company_id = ?
                """);
        List<Object> args = new ArrayList<>(List.of(companyId));
        if (!all) {
            sql.append("""
                    AND (LOWER(username) = LOWER(?) OR LOWER(username) IN (
                        SELECT LOWER(target_username) FROM report_view_permission
                        WHERE company_id = ? AND LOWER(viewer_username) = LOWER(?)))
                    """);
            args.add(user.username());
            args.add(companyId);
            args.add(user.username());
        }
        if (weekStart != null) {
            sql.append(" AND week_start = ? ");
            args.add(java.sql.Date.valueOf(weekStart));
        }
        sql.append(" ORDER BY week_start DESC, display_name");
        return jdbcTemplate.queryForList(sql.toString(), args.toArray());
    }

    /* ───────── 열람 권한 관리 (관리자) ───────── */

    public Map<String, Object> getPermissions(Long companyId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, viewer_username, target_username, memo FROM report_view_permission
                WHERE company_id = ? ORDER BY viewer_username, target_username
                """, companyId);
        List<Map<String, Object>> users = jdbcTemplate.queryForList("""
                SELECT username, display_name, role, department FROM dashboard_user
                WHERE company_id = ? AND status = 'ACTIVE' ORDER BY display_name
                """, companyId);
        return Map.of("permissions", rows, "users", users);
    }

    @Transactional
    public Map<String, Object> savePermissions(Long companyId, List<Map<String, Object>> rows) {
        jdbcTemplate.update("DELETE FROM report_view_permission WHERE company_id = ?", companyId);
        int saved = 0;
        for (Map<String, Object> r : rows) {
            String viewer = trimToNull(r.get("viewerUsername"));
            String target = trimToNull(r.get("targetUsername"));
            if (viewer == null || target == null || viewer.equalsIgnoreCase(target)) continue;
            jdbcTemplate.update("""
                    INSERT INTO report_view_permission (company_id, viewer_username, target_username, memo)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (company_id, viewer_username, target_username) DO NOTHING
                    """, companyId, viewer, target, trimToNull(r.get("memo")));
            saved++;
        }
        return Map.of("success", true, "saved", saved);
    }

    /* ───────── 내부 ───────── */

    private AiProviderSetting firstActiveSetting(Long companyId) {
        return aiProviderSettingRepository.findByCompanyIdOrderByProviderAsc(companyId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .filter(s -> s.getApiKey() != null && !s.getApiKey().isBlank())
                .findFirst().orElse(null);
    }

    /** 카탈로그에서 사용 가능한 모델을 동적으로 선택 — 경량 모델 우선, 실패 시 하드코딩 fallback */
    private String resolveModel(Long companyId, AiProvider provider) {
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
                        if (m.value() != null && m.value().toLowerCase().contains(pref)) return m.value();
                    }
                }
                return models.get(0).value();
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

    private static LocalDate resolveWeekStart(String value) {
        LocalDate base;
        try {
            base = LocalDate.parse(value.substring(0, 10));
        } catch (Exception e) {
            base = LocalDate.now().minusWeeks(1);
        }
        return base.with(DayOfWeek.MONDAY);
    }

    private static void appendSection(StringBuilder sb, String label, Object value) {
        if (value == null) return;
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) return;
        sb.append("(").append(label).append(")\n").append(text).append("\n");
    }

    private static String trimToNull(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }
}
