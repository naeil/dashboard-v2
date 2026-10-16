package naeil.dashboard.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.common.exception.CustomException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AI 공동구매 — 공구 셀러별 조건 판단(승인·보류·거절, 거래 방식, 수수료율, 일정)과 일정별 할 일.
 * 운영 에이전트가 공구 회신을 받으면 /api/agent/ingest/group-buys 로 '검토 중' 건을 올리고,
 * 실무진이 관제실·AI 공동구매 화면에서 판단을 입력하면 시작·마감일 기준 일정이 자동으로 만들어진다.
 */
@Service
@RequiredArgsConstructor
public class GroupBuyService {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Set<String> STATUSES = Set.of("PENDING", "APPROVED", "HOLD", "REJECTED", "RUNNING", "DONE", "CANCELLED");
    private static final Set<String> DEAL_TYPES = Set.of("COMMISSION", "CONSIGN", "BUY");
    private static final Set<String> DECISIONS = Set.of("APPROVE", "HOLD", "REJECT");

    private static final String DEAL_COLUMNS = """
            SELECT id, seller_name, channel, contact_email, owner_name, status, deal_type,
                   commission_rate, sale_price, products, expected_qty,
                   TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date, TO_CHAR(end_date, 'YYYY-MM-DD') AS end_date,
                   request_summary, memo, decided_by,
                   TO_CHAR(decided_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS') || '+09:00' AS decided_at,
                   related_task_id, source, source_key,
                   TO_CHAR(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS') || '+09:00' AS created_at,
                   TO_CHAR(updated_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS') || '+09:00' AS updated_at
            FROM group_buy_deal
            """;

    private final JdbcTemplate jdbcTemplate;
    private final ContactLogService contactLogService;

    // ===== 조회 =====

    /** 공구 목록(일정 포함). status 를 주면 그 상태만. 검토 중 → 진행 순으로 정렬. */
    public List<Map<String, Object>> list(Long companyId, String status) {
        StringBuilder sql = new StringBuilder(DEAL_COLUMNS).append(" WHERE company_id = ?");
        List<Object> params = new ArrayList<>();
        params.add(companyId);
        if (notBlank(status)) {
            sql.append(" AND status = ?");
            params.add(status.trim().toUpperCase());
        }
        sql.append("""
                 ORDER BY CASE status WHEN 'PENDING' THEN 0 WHEN 'APPROVED' THEN 1 WHEN 'RUNNING' THEN 2
                                      WHEN 'HOLD' THEN 3 WHEN 'DONE' THEN 4 ELSE 5 END,
                          start_date NULLS LAST, created_at DESC
                """);
        List<Map<String, Object>> deals = jdbcTemplate.queryForList(sql.toString(), params.toArray());
        if (deals.isEmpty()) return deals;
        List<Long> ids = deals.stream().map(d -> ((Number) d.get("id")).longValue()).toList();
        String in = ids.stream().map(x -> "?").collect(Collectors.joining(","));
        List<Map<String, Object>> events = jdbcTemplate.queryForList(
                "SELECT id, deal_id, TO_CHAR(event_date, 'YYYY-MM-DD') AS event_date, title, owner_name, done, done_by, auto "
                        + "FROM group_buy_event WHERE deal_id IN (" + in + ") ORDER BY event_date, id", ids.toArray());
        Map<Long, List<Map<String, Object>>> byDeal = new LinkedHashMap<>();
        for (Map<String, Object> e : events) {
            byDeal.computeIfAbsent(((Number) e.get("deal_id")).longValue(), k -> new ArrayList<>()).add(e);
        }
        for (Map<String, Object> d : deals) {
            d.put("events", byDeal.getOrDefault(((Number) d.get("id")).longValue(), List.of()));
        }
        return deals;
    }

    /** 일정 보기: from~to 사이 할 일(취소·거절 건 제외), 날짜순. */
    public List<Map<String, Object>> schedule(Long companyId, String from, String to) {
        LocalDate f = notBlank(from) ? day(from, "from") : LocalDate.now(SEOUL).minusDays(7);
        LocalDate t = notBlank(to) ? day(to, "to") : LocalDate.now(SEOUL).plusDays(45);
        return jdbcTemplate.queryForList("""
                SELECT e.id, e.deal_id, TO_CHAR(e.event_date, 'YYYY-MM-DD') AS event_date, e.title,
                       COALESCE(e.owner_name, d.owner_name) AS owner_name, e.done, e.done_by, e.auto,
                       d.seller_name, d.status AS deal_status, d.deal_type, d.commission_rate
                FROM group_buy_event e JOIN group_buy_deal d ON d.id = e.deal_id
                WHERE d.company_id = ? AND e.event_date BETWEEN ? AND ? AND d.status NOT IN ('CANCELLED', 'REJECTED')
                ORDER BY e.event_date, d.seller_name, e.id
                """, companyId, java.sql.Date.valueOf(f), java.sql.Date.valueOf(t));
    }

    public Map<String, Object> get(Long companyId, Long id) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(DEAL_COLUMNS + " WHERE company_id = ? AND id = ?", companyId, id);
        if (rows.isEmpty()) throw new CustomException(404, "공동구매 건을 찾을 수 없습니다.");
        Map<String, Object> deal = rows.get(0);
        deal.put("events", jdbcTemplate.queryForList(
                "SELECT id, deal_id, TO_CHAR(event_date, 'YYYY-MM-DD') AS event_date, title, owner_name, done, done_by, auto "
                        + "FROM group_buy_event WHERE deal_id = ? ORDER BY event_date, id", id));
        return deal;
    }

    // ===== 등록·수정 =====

    /** 직접 등록(MANUAL) 또는 에이전트 등록(AGENT). source_key 가 같으면 기존 건의 요청 요약·연락처만 갱신. */
    @Transactional
    public Map<String, Object> create(Long companyId, Map<String, Object> body, String source) {
        String seller = required(body, "sellerName", 200);
        String sourceKey = limit(text(body.get("sourceKey")), 160);
        if (sourceKey != null) {
            List<Long> found = jdbcTemplate.queryForList(
                    "SELECT id FROM group_buy_deal WHERE company_id = ? AND source_key = ?", Long.class, companyId, sourceKey);
            if (!found.isEmpty()) {
                jdbcTemplate.update("""
                        UPDATE group_buy_deal SET request_summary = COALESCE(?, request_summary),
                               contact_email = COALESCE(?, contact_email), updated_at = NOW()
                        WHERE id = ?
                        """, text(body.get("requestSummary")), limit(text(body.get("contactEmail")), 200), found.get(0));
                Map<String, Object> r = get(companyId, found.get(0));
                r.put("created", false);
                return r;
            }
        }
        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO group_buy_deal (company_id, seller_name, channel, contact_email, owner_name, status,
                    deal_type, commission_rate, sale_price, products, expected_qty, start_date, end_date,
                    request_summary, memo, related_task_id, source, source_key)
                VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class, companyId, seller, limit(text(body.get("channel")), 40),
                limit(text(body.get("contactEmail")), 200), limit(text(body.get("ownerName")), 100),
                dealType(body.get("dealType")), rate(body.get("commissionRate")), integer(body.get("salePrice")),
                text(body.get("products")), integer(body.get("expectedQty")),
                sqlDate(body.get("startDate"), "startDate"), sqlDate(body.get("endDate"), "endDate"),
                text(body.get("requestSummary")), text(body.get("memo")),
                body.get("relatedTaskId") == null ? null : Long.valueOf(String.valueOf(body.get("relatedTaskId"))),
                source, sourceKey);
        Map<String, Object> r = get(companyId, id);
        r.put("created", true);
        return r;
    }

    /** 담당자·연락처·구성·판매가 등 일반 항목 수정(판단·일정은 decide). */
    @Transactional
    public Map<String, Object> update(Long companyId, Long id, Map<String, Object> body) {
        get(companyId, id);
        jdbcTemplate.update("""
                UPDATE group_buy_deal SET
                    seller_name = COALESCE(?, seller_name), channel = ?, contact_email = ?, owner_name = ?,
                    products = ?, expected_qty = ?, sale_price = ?, memo = ?, updated_at = NOW()
                WHERE company_id = ? AND id = ?
                """, limit(text(body.get("sellerName")), 200), limit(text(body.get("channel")), 40),
                limit(text(body.get("contactEmail")), 200), limit(text(body.get("ownerName")), 100),
                text(body.get("products")), integer(body.get("expectedQty")), integer(body.get("salePrice")),
                text(body.get("memo")), companyId, id);
        return get(companyId, id);
    }

    /**
     * 조건 판단: decision = APPROVE / HOLD / REJECT.
     * 승인하면 거래 방식·수수료율(수수료형)·시작·마감일이 필요하고, 그 날짜로 일정(자동 생성분)을 다시 만든다.
     */
    @Transactional
    public Map<String, Object> decide(Long companyId, Long id, Map<String, Object> body, String actor) {
        Map<String, Object> deal = get(companyId, id);
        String decision = text(body.get("decision"));
        if (decision == null || !DECISIONS.contains(decision.toUpperCase())) {
            throw new CustomException(400, "판단(승인·보류·거절)을 선택해 주세요.");
        }
        decision = decision.toUpperCase();
        String owner = limit(firstNonBlank(text(body.get("ownerName")), (String) deal.get("owner_name")), 100);
        String memo = text(body.get("memo"));
        if (!"APPROVE".equals(decision)) {
            if (memo == null) throw new CustomException(400, ("HOLD".equals(decision) ? "보류" : "거절") + " 사유를 메모에 적어 주세요.");
            jdbcTemplate.update("""
                    UPDATE group_buy_deal SET status = ?, owner_name = ?, memo = COALESCE(?, memo),
                           decided_by = ?, decided_at = NOW(), updated_at = NOW()
                    WHERE company_id = ? AND id = ?
                    """, "HOLD".equals(decision) ? "HOLD" : "REJECTED", owner, memo, actor, companyId, id);
            logDecision(companyId, deal, "HOLD".equals(decision) ? "보류" : "거절", owner, "사유: " + memo, null, null,
                    "REJECT".equals(decision), actor);
            return get(companyId, id);
        }
        String type = dealType(body.get("dealType"));
        if (type == null) throw new CustomException(400, "거래 방식(수수료형·위탁·사입)을 선택해 주세요.");
        BigDecimal rate = rate(body.get("commissionRate"));
        if ("COMMISSION".equals(type) && rate == null) throw new CustomException(400, "수수료형은 수수료율(%)을 입력해 주세요.");
        java.sql.Date start = sqlDate(body.get("startDate"), "startDate");
        java.sql.Date end = sqlDate(body.get("endDate"), "endDate");
        if (start == null || end == null) throw new CustomException(400, "공구 시작일과 마감일을 입력해 주세요.");
        if (end.before(start)) throw new CustomException(400, "마감일이 시작일보다 빠릅니다.");
        jdbcTemplate.update("""
                UPDATE group_buy_deal SET status = 'APPROVED', deal_type = ?, commission_rate = ?, sale_price = COALESCE(?, sale_price),
                       products = COALESCE(?, products), start_date = ?, end_date = ?, owner_name = ?, memo = COALESCE(?, memo),
                       decided_by = ?, decided_at = NOW(), updated_at = NOW()
                WHERE company_id = ? AND id = ?
                """, type, rate, integer(body.get("salePrice")), text(body.get("products")), start, end, owner, memo,
                actor, companyId, id);
        rebuildSchedule(id, start.toLocalDate(), end.toLocalDate(), owner);
        Integer price = integer(body.get("salePrice"));
        String terms = "거래 방식: " + typeLabel(type)
                + (rate != null ? " / 수수료율 " + rate.stripTrailingZeros().toPlainString() + "%" : "")
                + (price != null ? " / 공구 판매가 " + String.format("%,d", price) + "원" : "")
                + " / 기간 " + start + " ~ " + end;
        String steps = "샘플 발송(" + start.toLocalDate().minusDays(14) + ")\n게시물 검수(" + start.toLocalDate().minusDays(3)
                + ")\n판매 링크·재고 준비(" + start.toLocalDate().minusDays(2) + ")\n공구 오픈(" + start + ") ~ 마감(" + end
                + ")\n판매수량 확인(" + end.toLocalDate().plusDays(1) + ")\n정산(" + end.toLocalDate().plusDays(7) + ")";
        logDecision(companyId, deal, "승인", owner, memo == null ? null : "메모: " + memo, terms, steps, false, actor);
        return get(companyId, id);
    }

    /** 진행 상태 변경(진행 중·종료·취소)도 상담·미팅 기록에 남긴다. */
    private void logStatus(Long companyId, Map<String, Object> deal, String label, String actor) {
        logDecision(companyId, deal, label, (String) deal.get("owner_name"), null, null, null,
                "종료".equals(label) || "취소".equals(label), actor);
    }

    /** 공동구매 판단을 상담·미팅 기록(contact_log)에 자동 기재(같은 트랜잭션 — 기록이 실패하면 판단도 저장되지 않는다). */
    private void logDecision(Long companyId, Map<String, Object> deal, String label, String owner, String note,
                             String terms, String steps, boolean closed, String actor) {
        String email = (String) deal.get("contact_email");
        StringBuilder summary = new StringBuilder("[공동구매 판단] ").append(label);
        if (email != null && !email.isBlank()) summary.append(" (").append(email).append(")");
        if (note != null) summary.append("\n").append(note);
        Map<String, Object> log = new LinkedHashMap<>();
        log.put("partnerName", deal.get("seller_name"));
        log.put("contactType", "OTHER");
        log.put("staffName", owner);
        log.put("summary", summary.toString());
        if (terms != null) log.put("agreements", terms);
        if (steps != null) log.put("nextAction", steps);
        log.put("status", closed ? "DONE" : "OPEN");
        contactLogService.create(companyId, log, "MANUAL", actor);
    }

    private static String typeLabel(String type) {
        return switch (type) {
            case "COMMISSION" -> "수수료형";
            case "CONSIGN" -> "위탁";
            case "BUY" -> "사입";
            default -> type;
        };
    }

    /** 진행 상태만 바꾸기(진행중·종료·취소 등). */
    @Transactional
    public Map<String, Object> setStatus(Long companyId, Long id, String status, String actor) {
        get(companyId, id);
        if (status == null || !STATUSES.contains(status.trim().toUpperCase())) throw new CustomException(400, "상태 값이 올바르지 않습니다.");
        String st = status.trim().toUpperCase();
        Map<String, Object> deal = get(companyId, id);
        jdbcTemplate.update("UPDATE group_buy_deal SET status = ?, updated_at = NOW() WHERE company_id = ? AND id = ?",
                st, companyId, id);
        Map<String, String> label = Map.of("RUNNING", "진행 중", "DONE", "종료", "CANCELLED", "취소", "HOLD", "보류",
                "APPROVED", "승인", "PENDING", "판단 대기", "REJECTED", "거절");
        logStatus(companyId, deal, label.getOrDefault(st, st), actor);
        return get(companyId, id);
    }

    // ===== 일정 =====

    @Transactional
    public Map<String, Object> addEvent(Long companyId, Long dealId, Map<String, Object> body) {
        Map<String, Object> deal = get(companyId, dealId);
        java.sql.Date date = sqlDate(body.get("eventDate"), "eventDate");
        if (date == null) throw new CustomException(400, "날짜를 입력해 주세요.");
        jdbcTemplate.update("INSERT INTO group_buy_event (deal_id, event_date, title, owner_name, auto) VALUES (?, ?, ?, ?, FALSE)",
                dealId, date, required(body, "title", 200),
                limit(firstNonBlank(text(body.get("ownerName")), (String) deal.get("owner_name")), 100));
        return get(companyId, dealId);
    }

    @Transactional
    public Map<String, Object> setEventDone(Long companyId, Long eventId, boolean done, String actor) {
        List<Long> dealIds = jdbcTemplate.queryForList("""
                SELECT e.deal_id FROM group_buy_event e JOIN group_buy_deal d ON d.id = e.deal_id
                WHERE e.id = ? AND d.company_id = ?
                """, Long.class, eventId, companyId);
        if (dealIds.isEmpty()) throw new CustomException(404, "일정을 찾을 수 없습니다.");
        jdbcTemplate.update("UPDATE group_buy_event SET done = ?, done_by = ? WHERE id = ?", done, done ? actor : null, eventId);
        return get(companyId, dealIds.get(0));
    }

    @Transactional
    public Map<String, Object> deleteEvent(Long companyId, Long eventId) {
        List<Long> dealIds = jdbcTemplate.queryForList("""
                SELECT e.deal_id FROM group_buy_event e JOIN group_buy_deal d ON d.id = e.deal_id
                WHERE e.id = ? AND d.company_id = ?
                """, Long.class, eventId, companyId);
        if (dealIds.isEmpty()) throw new CustomException(404, "일정을 찾을 수 없습니다.");
        jdbcTemplate.update("DELETE FROM group_buy_event WHERE id = ?", eventId);
        return get(companyId, dealIds.get(0));
    }

    /** 승인 시 자동 일정: 샘플 발송(D-14) → 게시물 검수(D-3) → 판매 준비(D-2) → 오픈 → 마감 → 판매수량 확인(+1) → 정산(+7). */
    private void rebuildSchedule(Long dealId, LocalDate start, LocalDate end, String owner) {
        jdbcTemplate.update("DELETE FROM group_buy_event WHERE deal_id = ? AND auto = TRUE AND done = FALSE", dealId);
        LocalDate today = LocalDate.now(SEOUL);
        Object[][] plan = {
                {start.minusDays(14), "샘플 발송 · 송장 전달"},
                {start.minusDays(3), "게시물 검수(광고 표기·효능 표현)"},
                {start.minusDays(2), "판매 링크·할인코드·재고 준비"},
                {start, "공구 오픈 확인"},
                {end, "공구 마감"},
                {end.plusDays(1), "판매수량 확인"},
                {end.plusDays(7), "정산서 발송·지급"},
        };
        for (Object[] p : plan) {
            LocalDate d = (LocalDate) p[0];
            if (d.isBefore(today) && ((LocalDate) p[0]).isBefore(start)) d = today;   // 이미 지난 준비 일정은 오늘로
            jdbcTemplate.update("INSERT INTO group_buy_event (deal_id, event_date, title, owner_name, auto) VALUES (?, ?, ?, ?, TRUE)",
                    dealId, java.sql.Date.valueOf(d), p[1], owner);
        }
    }

    // ===== 공용 설정 (공급가표·업무 절차·확정 필요 항목) =====

    private static final Set<String> SETTING_KEYS = Set.of("prices", "procedure", "confirm");

    public Map<String, Object> settings(Long companyId) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map<String, Object> r : jdbcTemplate.queryForList("""
                SELECT setting_key, value, updated_by,
                       TO_CHAR(updated_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS updated_at
                FROM group_buy_setting WHERE company_id = ?
                """, companyId)) {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("value", r.get("value"));
            v.put("updated_by", r.get("updated_by"));
            v.put("updated_at", r.get("updated_at"));
            out.put(String.valueOf(r.get("setting_key")), v);
        }
        return out;
    }

    @Transactional
    public Map<String, Object> saveSetting(Long companyId, String key, Object value, String actor) {
        if (key == null || !SETTING_KEYS.contains(key)) throw new CustomException(400, "설정 항목이 올바르지 않습니다.");
        String json = value == null ? null : String.valueOf(value);
        if (json == null || json.isBlank()) throw new CustomException(400, "저장할 값이 비어 있습니다.");
        if (json.length() > 50000) throw new CustomException(400, "값이 너무 큽니다.");
        jdbcTemplate.update("""
                INSERT INTO group_buy_setting (company_id, setting_key, value, updated_by, updated_at)
                VALUES (?, ?, ?, ?, NOW())
                ON CONFLICT (company_id, setting_key)
                DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
                """, companyId, key, json, limit(actor, 100));
        return settings(companyId);
    }

    // ===== 헬퍼 =====

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private static String text(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static String limit(String s, int max) { return s == null || s.length() <= max ? s : s.substring(0, max); }

    private static String firstNonBlank(String a, String b) { return notBlank(a) ? a : b; }

    private static String required(Map<String, Object> body, String key, int max) {
        String s = text(body == null ? null : body.get(key));
        if (s == null) throw new CustomException(400, key + " 값이 필요합니다.");
        return limit(s, max);
    }

    private static Integer integer(Object v) {
        String s = text(v);
        if (s == null) return null;
        try { return Integer.valueOf(s.replace(",", "")); } catch (NumberFormatException e) { throw new CustomException(400, "숫자 값이 올바르지 않습니다: " + s); }
    }

    private static BigDecimal rate(Object v) {
        String s = text(v);
        if (s == null) return null;
        try {
            BigDecimal r = new BigDecimal(s.replace("%", ""));
            if (r.signum() < 0 || r.compareTo(BigDecimal.valueOf(100)) > 0) throw new CustomException(400, "수수료율은 0~100 사이로 입력해 주세요.");
            return r;
        } catch (NumberFormatException e) { throw new CustomException(400, "수수료율이 올바르지 않습니다."); }
    }

    private static String dealType(Object v) {
        String s = text(v);
        if (s == null) return null;
        s = s.toUpperCase();
        if (!DEAL_TYPES.contains(s)) throw new CustomException(400, "거래 방식 값이 올바르지 않습니다.");
        return s;
    }

    private static LocalDate day(String s, String field) {
        try { return LocalDate.parse(s.trim().substring(0, 10)); } catch (DateTimeParseException | StringIndexOutOfBoundsException e) {
            throw new CustomException(400, field + " 날짜 형식이 올바르지 않습니다(yyyy-MM-dd).");
        }
    }

    private static java.sql.Date sqlDate(Object v, String field) {
        String s = text(v);
        return s == null ? null : java.sql.Date.valueOf(day(s, field));
    }
}
