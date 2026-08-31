package naeil.dashboard.service;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
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
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTable;
import org.apache.poi.xslf.usermodel.XSLFTableCell;
import org.apache.poi.xslf.usermodel.XSLFTableRow;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 주간 업무 보고 — 월요일 회의 후 보고 파일(PPT·워드·텍스트)을 등록하면
 * 본문을 추출해 저장하고, AI가 경영진(의사결정)·실무진(실행) 관점으로 현황을 분석한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WeeklyBizReportService {

    private static final int MAX_TEXT = 60_000;
    private static final String SYSTEM_PROMPT = """
            너는 주식회사 내일그룹의 경영 참모다. 주간 업무 보고를 읽고 경영진과 실무진이 10분 회의로 판단·실행할 수 있게 정리한다.

            규칙:
            - 보고에 적힌 내용만 사용한다. 없는 사실·숫자를 지어내지 않는다.
            - 항목당 한 줄, 최대 40자 개조식. 중요도 순으로 배열한다.
            - 숫자가 있으면 반드시 인용한다.
            - 아래 형식을 그대로 따른다. 형식 외 텍스트·마크다운 헤더 금지.

            형식:
            【한 줄 총평】
            (이번 주 회사 상태를 1문장으로, 70자 이내)

            【잘 되고 있는 것】
            - (성과·진전 최대 4개)

            【리스크 · 막힘】
            - (문제·지연·우려. 없으면 "없음")

            【의사결정 필요 — 경영진】
            - (대표가 결정·승인해야 할 것. 없으면 "없음")

            【이번 주 실행 — 실무진】
            - (담당자가 바로 해야 할 액션 최대 5개, 가능하면 담당자명 표기)

            【지난주 대비 변화】
            - (지난주 보고가 제공된 경우만. 개선/악화/신규 이슈. 없으면 "비교 데이터 없음")
            """;

    private volatile String cachedModel;
    private volatile AiProvider cachedModelProvider;
    private volatile long cachedModelAt;

    private final JdbcTemplate jdbcTemplate;
    private final AiApiClient aiApiClient;
    private final AiProviderSettingRepository aiProviderSettingRepository;
    private final AiProviderSettingService aiProviderSettingService;

    /* ───────── 등록 ───────── */

    public Map<String, Object> upload(Long companyId, AuthUser user, String weekStartStr,
                                      String title, byte[] bytes, String filename) {
        if (bytes == null || bytes.length == 0) {
            return Map.of("success", false, "message", "파일이 비어 있습니다.");
        }
        String text;
        try {
            text = extractText(bytes, filename);
        } catch (Exception e) {
            log.warn("[WeeklyBiz] 텍스트 추출 실패: {}", e.getMessage());
            return Map.of("success", false, "message", "파일 내용을 읽지 못했습니다. PPTX·DOCX·TXT 형식인지 확인하세요.");
        }
        if (text == null || text.isBlank() || text.trim().length() < 20) {
            return Map.of("success", false, "message", "파일에서 텍스트를 찾지 못했습니다. (이미지로만 된 파일은 지원하지 않습니다)");
        }
        if (text.length() > MAX_TEXT) text = text.substring(0, MAX_TEXT);

        LocalDate weekStart = resolveWeekStart(weekStartStr);
        String finalTitle = title != null && !title.isBlank() ? title.trim()
                : (filename != null && !filename.isBlank() ? filename : weekStart + " 주간 업무 보고");

        jdbcTemplate.update("""
                INSERT INTO weekly_biz_report (company_id, week_start, title, file_name, raw_text, uploaded_by, uploader_name)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, companyId, java.sql.Date.valueOf(weekStart), finalTitle, filename, text,
                user.username(), user.displayName());
        Long id = jdbcTemplate.queryForObject(
                "SELECT id FROM weekly_biz_report WHERE company_id = ? ORDER BY id DESC LIMIT 1", Long.class, companyId);

        // 등록 즉시 AI 분석 시도 (실패해도 등록은 유지 — 화면에서 재시도 가능)
        Map<String, Object> analysis = analyze(companyId, id);
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("success", true);
        result.put("id", id);
        result.put("weekStart", weekStart.toString());
        result.put("title", finalTitle);
        result.put("textLength", text.length());
        result.put("aiAnalyzed", Boolean.TRUE.equals(analysis.get("success")));
        if (!Boolean.TRUE.equals(analysis.get("success"))) {
            result.put("aiMessage", analysis.get("message"));
        }
        return result;
    }

    /* ───────── AI 분석 ───────── */

    public Map<String, Object> analyze(Long companyId, Long id) {
        Map<String, Object> row;
        try {
            row = jdbcTemplate.queryForMap(
                    "SELECT week_start, title, raw_text FROM weekly_biz_report WHERE id = ? AND company_id = ?",
                    id, companyId);
        } catch (Exception e) {
            return Map.of("success", false, "message", "보고를 찾을 수 없습니다.");
        }
        AiProviderSetting setting = firstActiveSetting(companyId);
        if (setting == null) {
            return Map.of("success", false, "message", "활성화된 AI 인증 정보가 없습니다. [시스템 > AI 설정]에서 등록하세요.");
        }
        String model = resolveModel(companyId, setting.getProvider());

        String raw = String.valueOf(row.get("raw_text"));
        if (raw.length() > 14_000) raw = raw.substring(0, 14_000) + "\n(이하 생략)";

        // 직전 주 보고 (있으면 델타 분석)
        String previous = null;
        try {
            List<Map<String, Object>> prevRows = jdbcTemplate.queryForList("""
                    SELECT COALESCE(ai_summary, LEFT(raw_text, 3000)) AS prev
                    FROM weekly_biz_report
                    WHERE company_id = ? AND week_start < ? AND id <> ?
                    ORDER BY week_start DESC, id DESC LIMIT 1
                    """, companyId, row.get("week_start"), id);
            if (!prevRows.isEmpty()) previous = String.valueOf(prevRows.get(0).get("prev"));
        } catch (Exception ignored) {
            // 이전 보고 없음
        }

        StringBuilder userMessage = new StringBuilder();
        userMessage.append("[이번 주 보고] ").append(row.get("week_start")).append(" · ").append(row.get("title")).append("\n\n");
        userMessage.append(raw);
        if (previous != null && !previous.isBlank()) {
            userMessage.append("\n\n[지난주 보고 요약 (비교용)]\n").append(previous, 0, Math.min(previous.length(), 3000));
        }

        try {
            String answer = aiApiClient.complete(setting, model, SYSTEM_PROMPT, userMessage.toString());
            jdbcTemplate.update(
                    "UPDATE weekly_biz_report SET ai_summary = ?, ai_model = ?, ai_analyzed_at = NOW() WHERE id = ?",
                    answer == null ? "" : answer.trim(), model, id);
            return Map.of("success", true, "id", id, "model", model);
        } catch (Exception e) {
            log.warn("[WeeklyBiz] AI 분석 실패: {}", e.getMessage());
            String msg = String.valueOf(e.getMessage());
            if (msg.contains("429") || msg.toLowerCase().contains("quota")) {
                return Map.of("success", false, "message", "AI 사용량 한도 초과 — 잠시 후 [AI 분석] 버튼으로 재시도하세요.");
            }
            return Map.of("success", false, "message", "AI 분석 실패: " + msg.substring(0, Math.min(msg.length(), 140)));
        }
    }

    /* ───────── 조회/삭제 ───────── */

    public List<Map<String, Object>> list(Long companyId) {
        return jdbcTemplate.queryForList("""
                SELECT id, week_start, title, file_name, uploaded_by, uploader_name,
                       ai_summary, ai_model, ai_analyzed_at, created_at, LENGTH(raw_text) AS text_length
                FROM weekly_biz_report
                WHERE company_id = ?
                ORDER BY week_start DESC, id DESC
                LIMIT 60
                """, companyId);
    }

    public Map<String, Object> get(Long companyId, Long id) {
        return jdbcTemplate.queryForMap(
                "SELECT * FROM weekly_biz_report WHERE id = ? AND company_id = ?", id, companyId);
    }

    public Map<String, Object> delete(Long companyId, Long id, AuthUser user) {
        if (UserRole.from(user.role()) != UserRole.EXECUTIVE) {
            Integer own = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM weekly_biz_report WHERE id = ? AND LOWER(uploaded_by) = LOWER(?)",
                    Integer.class, id, user.username());
            if (own == null || own == 0) {
                return Map.of("success", false, "message", "본인이 등록한 보고만 삭제할 수 있습니다.");
            }
        }
        jdbcTemplate.update("DELETE FROM weekly_biz_report WHERE id = ? AND company_id = ?", id, companyId);
        return Map.of("success", true);
    }

    /* ───────── 텍스트 추출 ───────── */

    static String extractText(byte[] bytes, String filename) throws Exception {
        String lower = filename == null ? "" : filename.toLowerCase();
        if (lower.endsWith(".pptx")) {
            StringBuilder sb = new StringBuilder();
            try (XMLSlideShow ppt = new XMLSlideShow(new ByteArrayInputStream(bytes))) {
                int slideNo = 1;
                for (XSLFSlide slide : ppt.getSlides()) {
                    sb.append("=== 슬라이드 ").append(slideNo++).append(" ===\n");
                    for (XSLFShape shape : slide.getShapes()) {
                        appendShape(sb, shape);
                    }
                    sb.append("\n");
                }
            }
            return sb.toString();
        }
        if (lower.endsWith(".docx")) {
            try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes));
                 XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
                return extractor.getText();
            }
        }
        // txt/csv/md — UTF-8 (BOM 제거)
        byte[] body = bytes;
        if (bytes.length >= 3 && (bytes[0] & 0xFF) == 0xEF && (bytes[1] & 0xFF) == 0xBB && (bytes[2] & 0xFF) == 0xBF) {
            body = java.util.Arrays.copyOfRange(bytes, 3, bytes.length);
        }
        return new String(body, StandardCharsets.UTF_8);
    }

    private static void appendShape(StringBuilder sb, XSLFShape shape) {
        if (shape instanceof XSLFTextShape textShape) {
            String text = textShape.getText();
            if (text != null && !text.isBlank()) sb.append(text.trim()).append("\n");
        } else if (shape instanceof XSLFTable table) {
            for (XSLFTableRow row : table.getRows()) {
                StringBuilder line = new StringBuilder();
                for (XSLFTableCell cellShape : row.getCells()) {
                    String cell = cellShape.getText();
                    if (cell != null && !cell.isBlank()) {
                        if (line.length() > 0) line.append(" | ");
                        line.append(cell.trim());
                    }
                }
                if (line.length() > 0) sb.append(line).append("\n");
            }
        }
    }

    private static LocalDate resolveWeekStart(String value) {
        LocalDate base;
        try {
            base = value == null || value.isBlank() ? LocalDate.now() : LocalDate.parse(value.substring(0, 10));
        } catch (Exception e) {
            base = LocalDate.now();
        }
        return base.with(DayOfWeek.MONDAY);
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
                        if (m.value() != null && m.value().toLowerCase().contains(pref)) {
                            cachedModel = m.value();
                            cachedModelProvider = provider;
                            cachedModelAt = System.currentTimeMillis();
                            return cachedModel;
                        }
                    }
                }
                cachedModel = models.get(0).value();
                cachedModelProvider = provider;
                cachedModelAt = System.currentTimeMillis();
                return cachedModel;
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
}
