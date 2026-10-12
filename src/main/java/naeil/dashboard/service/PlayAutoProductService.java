package naeil.dashboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.common.api.PlayAutoApiClient;
import naeil.dashboard.common.exception.CustomException;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.UserRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 플레이오토 온라인상품 조회·수정.
 * 마스터 상품(shop_cd/shop_id = master)을 수정하고 edit_slave_all 로 연동 쇼핑몰에 함께 반영한다.
 * - 수정 가능 항목은 화이트리스트로 제한한다(카테고리·템플릿·배송 등은 플레이오토 화면에서).
 * - 판매가 변경은 대표(EXECUTIVE)만, confirmPriceChange=true 일 때만 반영한다.
 * - 표시·광고 위험 표현을 점검하고, 경고가 있으면 acknowledgeWarnings=true 일 때만 저장한다.
 * - 모든 수정은 agent_activity 에 이력으로 남긴다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlayAutoProductService {

    private static final Long COMPANY = 1L;
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> OPTION_STATUSES = Set.of("정상", "품절");

    /** 식품 표시·광고에서 문제가 되기 쉬운 표현 (질병·효능·오인 소지). 경고만 하고 판단은 사람이. */
    private static final List<Rule> CLAIM_RULES = List.of(
            new Rule("살\\s*빠|체중\\s*감량|다이어트\\s*효과|지방\\s*(분해|연소|감소)|체지방", "체중·체지방 효능 표현 — 일반식품은 사용 불가"),
            new Rule("혈당|당뇨|혈압|콜레스테롤|면역|치료|예방|개선\\s*효과|질병", "질병 예방·치료·건강기능 표현 — 일반식품은 사용 불가"),
            new Rule("디톡스|해독|독소\\s*배출", "해독·디톡스 표현 — 근거 없는 효능 표시 소지"),
            new Rule("무설탕|슈가\\s*프리|sugar\\s*free", "'무설탕'은 표시기준(무당류/무가당) 충족 여부 확인 필요"),
            new Rule("최대\\s*\\d+\\s*g|단백질\\s*\\d+\\s*g", "단백질 g 표기는 해당 SKU 영양성분표 수치와 일치해야 함"),
            new Rule("최고|최초|유일|1위|넘버\\s*원|no\\.?\\s*1", "최상급·비교 표현 — 객관적 근거 필요"),
            new Rule("의사|약사|전문의\\s*추천|임상", "전문가 추천·임상 표현 — 근거 없으면 소비자 오인"));

    private final PlayAutoApiClient playAutoApiClient;
    private final IntegrationSettingService integrationSettingService;
    private final JdbcTemplate jdbcTemplate;

    public JsonNode search(String keyword, String saleStatus, int start, int length) {
        var cred = integrationSettingService.getValidPlayAutoCredentials(COMPANY);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("start", Math.max(0, start));
        body.put("length", Math.min(Math.max(1, length), 100));
        body.put("sdate", "2015-01-01");
        body.put("edate", LocalDate.now().toString());
        body.put("date_type", "wdate");
        body.put("orderby", "wdate desc");
        body.put("shop_cd", "only_mas");
        if (keyword != null && !keyword.isBlank()) {
            body.put("search_key", "shop_sale_name");
            body.put("search_word", keyword.trim());
            body.put("search_type", "partial");
        }
        if (saleStatus != null && !saleStatus.isBlank()) {
            body.put("sale_status", List.of(saleStatus.trim()));
        }
        return playAutoApiClient.listOnlineProducts(cred.accessToken(), cred.apiKey(), body);
    }

    public JsonNode detail(String olShopNo) {
        if (olShopNo == null || !olShopNo.matches("\\d+")) throw new CustomException(400, "상품 번호가 올바르지 않습니다.");
        var cred = integrationSettingService.getValidPlayAutoCredentials(COMPANY);
        return playAutoApiClient.getOnlineProduct(cred.accessToken(), cred.apiKey(), olShopNo);
    }

    /** 상품명·상세설명·키워드의 표시·광고 위험 표현 점검. */
    public List<Map<String, String>> checkClaims(String... texts) {
        List<Map<String, String>> warnings = new ArrayList<>();
        StringBuilder all = new StringBuilder();
        for (String t : texts) if (t != null) all.append(' ').append(t.replaceAll("<[^>]+>", " "));
        String text = all.toString();
        for (Rule rule : CLAIM_RULES) {
            var m = rule.pattern().matcher(text);
            if (m.find()) warnings.add(Map.of("match", m.group(), "reason", rule.reason()));
        }
        return warnings;
    }

    /**
     * body: c_sale_cd*, shop_sale_name, detail_desc, keywords, sale_cnt_limit, sale_price,
     *       opts[] (opt_sort1*, opt_sort1_desc*, stock_cnt*, status* … 옵션 전체를 보내야 함),
     *       edit_slave_all(기본 true), confirmPriceChange, acknowledgeWarnings
     */
    public Map<String, Object> edit(Map<String, Object> body, AuthUser actor) {
        String cSaleCd = text(body.get("c_sale_cd"));
        if (cSaleCd == null || cSaleCd.isBlank()) throw new CustomException(400, "c_sale_cd(판매자관리코드)가 필요합니다.");

        Map<String, Object> req = new LinkedHashMap<>();
        req.put("c_sale_cd", cSaleCd.trim());
        req.put("shop_cd", "master");
        req.put("shop_id", "master");
        req.put("edit_slave_all", !Boolean.FALSE.equals(body.get("edit_slave_all")));

        List<String> changed = new ArrayList<>();
        String name = text(body.get("shop_sale_name"));
        if (name != null) {
            if (name.isBlank()) throw new CustomException(400, "상품명이 비어 있습니다.");
            if (name.contains("|") || name.contains("#")) throw new CustomException(400, "상품명에 | 또는 # 은 사용할 수 없습니다.");
            if (name.getBytes(java.nio.charset.Charset.forName("EUC-KR")).length > 100) throw new CustomException(400, "상품명은 최대 100Byte입니다.");
            req.put("shop_sale_name", name.trim());
            changed.add("상품명");
        }
        String desc = text(body.get("detail_desc"));
        if (desc != null) { req.put("detail_desc", desc); changed.add("상세설명"); }
        String keywords = text(body.get("keywords"));
        if (keywords != null) { req.put("keywords", keywords); changed.add("키워드"); }
        if (body.get("sale_cnt_limit") != null) {
            req.put("sale_cnt_limit", toInt(body.get("sale_cnt_limit"), "판매수량"));
            changed.add("판매수량");
        }
        if (body.get("sale_price") != null) {
            if (UserRole.from(actor.role()) != UserRole.EXECUTIVE) {
                throw new CustomException(403, "판매가 변경은 대표만 할 수 있습니다.");
            }
            if (!Boolean.TRUE.equals(body.get("confirmPriceChange"))) {
                throw new CustomException(400, "판매가 변경 확인(confirmPriceChange)이 필요합니다.");
            }
            int price = toInt(body.get("sale_price"), "판매가");
            if (price <= 0 || price % 10 != 0) throw new CustomException(400, "판매가는 10원 단위의 양수여야 합니다.");
            req.put("sale_price", price);
            changed.add("판매가(" + price + "원)");
        }
        if (body.get("opts") instanceof List<?> opts && !opts.isEmpty()) {
            List<Map<String, Object>> cleaned = new ArrayList<>();
            for (Object o : opts) {
                if (!(o instanceof Map<?, ?> m)) throw new CustomException(400, "옵션 형식이 올바르지 않습니다.");
                String status = text(m.get("status"));
                if (!OPTION_STATUSES.contains(status)) throw new CustomException(400, "옵션 상태는 정상/품절만 가능합니다.");
                Map<String, Object> opt = new LinkedHashMap<>();
                for (String k : List.of("opt_sort1", "opt_sort1_desc", "opt_sort2", "opt_sort2_desc", "opt_sort3", "opt_sort3_desc", "sku_cd", "opt_custom_cd")) {
                    if (m.get(k) != null && !text(m.get(k)).isBlank()) opt.put(k, text(m.get(k)));
                }
                if (!opt.containsKey("opt_sort1") || !opt.containsKey("opt_sort1_desc")) {
                    throw new CustomException(400, "옵션명1과 옵션값1은 필수입니다.");
                }
                opt.put("stock_cnt", toInt(m.get("stock_cnt"), "옵션 판매수량"));
                opt.put("status", status);
                if (m.get("add_price") != null) opt.put("add_price", toInt(m.get("add_price"), "옵션 추가금액"));
                cleaned.add(opt);
            }
            req.put("opts", cleaned);
            changed.add("옵션(" + cleaned.size() + "개)");
        }
        if (changed.isEmpty()) throw new CustomException(400, "변경할 항목이 없습니다.");

        List<Map<String, String>> warnings = checkClaims(name, desc, keywords);
        if (!warnings.isEmpty() && !Boolean.TRUE.equals(body.get("acknowledgeWarnings"))) {
            Map<String, Object> blocked = new LinkedHashMap<>();
            blocked.put("saved", false);
            blocked.put("warnings", warnings);
            blocked.put("message", "표시·광고 점검 경고가 있습니다. 확인 후 다시 저장하세요.");
            return blocked;
        }

        var cred = integrationSettingService.getValidPlayAutoCredentials(COMPANY);
        JsonNode res = playAutoApiClient.editOnlineProduct(cred.accessToken(), cred.apiKey(), req);
        String result = res.isArray() && !res.isEmpty() ? res.get(0).path("result").asText("") : res.path("result").asText("");
        String message = res.isArray() && !res.isEmpty() ? res.get(0).path("message").asText("") : res.path("message").asText("");
        boolean ok = result.contains("성공") || (!result.contains("실패") && message.isBlank());

        logActivity(actor, cSaleCd, changed, ok, ok ? "" : message, warnings);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("saved", ok);
        out.put("changed", changed);
        out.put("warnings", warnings);
        out.put("playauto", res);
        if (!ok) out.put("message", message.isBlank() ? "플레이오토 수정 실패" : message);
        return out;
    }

    private void logActivity(AuthUser actor, String cSaleCd, List<String> changed, boolean ok, String error,
                             List<Map<String, String>> warnings) {
        try {
            String detail = "판매자관리코드 " + cSaleCd + " · 변경: " + String.join(", ", changed)
                    + (warnings.isEmpty() ? "" : " · 표시광고 경고 확인 후 저장 " + warnings.size() + "건");
            jdbcTemplate.update("""
                    INSERT INTO agent_activity (company_id, agent_name, kind, title, detail, status, result)
                    VALUES (?, ?, 'REPORT', ?, ?, ?, ?)
                    """, COMPANY, "상품수정:" + actor.username(),
                    "[플레이오토 상품 수정] " + cSaleCd, detail, ok ? "DONE" : "FAILED",
                    ok ? actor.displayName() + " 님이 수정 · 연동 쇼핑몰 반영 요청" : "실패: " + error);
        } catch (Exception e) {
            log.warn("상품 수정 이력 기록 실패: {}", e.getMessage());
        }
    }

    private static int toInt(Object v, String label) {
        try {
            return (int) Math.round(Double.parseDouble(String.valueOf(v).replace(",", "").trim()));
        } catch (Exception e) {
            throw new CustomException(400, label + " 값이 숫자가 아닙니다.");
        }
    }

    private static String text(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private record Rule(Pattern pattern, String reason) {
        Rule(String regex, String reason) {
            this(Pattern.compile(regex, Pattern.CASE_INSENSITIVE), reason);
        }
    }
}
