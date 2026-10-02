package naeil.dashboard.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.common.finance.FinanceCalculator;
import naeil.dashboard.common.finance.SettleSheetParser;
import naeil.dashboard.common.finance.SettleSheetParser.Row;
import org.springframework.stereotype.Service;

/**
 * 구글시트 '월말정산_자동' 탭 → CFO 대시보드 연동 (읽기 전용).
 *
 * 원칙
 *  - 시트는 읽기만 한다(gviz CSV). 시트 수정·Apps Script 설치 없음.
 *  - 판단은 대시보드 안에서: 시트 손익을 그대로 보여주되, 비율 가정(광고비 10%·물류비 20%·판관비 40%)으로
 *    채워진 값은 '추정'으로 표시하고, 판관비 가정 대신 대시보드에 등록된 실제 고정비로 커버율을 계산한다.
 *  - 대사(Reconciliation): 같은 달 대시보드 상품매출(주문+수기, 컨설팅 제외) vs 시트 전체 매출 차이를 표시.
 *  - 준실시간: 5분 캐시. 새로고침 요청 시 즉시 재수집(최소 30초 간격).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SettleAutoSheetService {

    public static final String TAB = "월말정산_자동";
    private static final Duration TTL = Duration.ofMinutes(5);
    private static final Duration MIN_REFRESH = Duration.ofSeconds(30);
    private static final BigDecimal GAP_ALERT_PCT = BigDecimal.valueOf(5);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final CfoFinanceService cfoFinanceService;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(20))
            .build();

    private record Cached(SettleSheetParser.Result result, Instant fetchedAt) {
    }

    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    public Map<String, Object> getReport(Long companyId, boolean refresh) {
        Cached cached;
        try {
            cached = load(refresh);
        } catch (IllegalStateException e) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("available", false);
            err.put("message", e.getMessage());
            err.put("source", source());
            return err;
        }
        return build(companyId, cached);
    }

    // ───────────────────────── 수집 ─────────────────────────

    private synchronized Cached load(boolean refresh) {
        String key = SheetSalesPullService.DEFAULT_SHEET_ID;
        Cached c = cache.get(key);
        Instant now = Instant.now();
        if (c != null) {
            Duration age = Duration.between(c.fetchedAt(), now);
            if (!refresh && age.compareTo(TTL) < 0) return c;
            if (refresh && age.compareTo(MIN_REFRESH) < 0) return c;
        }
        try {
            List<List<String>> csv = fetchCsv(key, TAB);
            Cached fresh = new Cached(SettleSheetParser.parse(csv), now);
            cache.put(key, fresh);
            return fresh;
        } catch (Exception e) {
            log.warn("[SettleAutoSheet] 수집 실패: {}", e.getMessage());
            if (c != null) return c; // 마지막 성공본 유지 (fetchedAt 으로 지연 노출)
            throw new IllegalStateException("'" + TAB + "' 탭을 읽지 못했습니다: " + e.getMessage());
        }
    }

    private List<List<String>> fetchCsv(String sheetId, String tab) throws Exception {
        String url = "https://docs.google.com/spreadsheets/d/" + sheetId
                + "/gviz/tq?tqx=out:csv&sheet=" + URLEncoder.encode(tab, StandardCharsets.UTF_8);
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30)).GET().build();
        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (resp.statusCode() != 200) throw new IllegalStateException("HTTP " + resp.statusCode());
        String body = resp.body();
        if (body == null || body.isBlank() || body.stripLeading().startsWith("<")) {
            throw new IllegalStateException("시트 공유설정(링크가 있는 모든 사용자 - 뷰어)을 확인하세요");
        }
        List<List<String>> rows = SheetSalesPullService.parseCsv(body);
        // gviz 는 없는 탭 이름을 받으면 첫 번째 탭을 돌려준다 → 헤더로 검증
        boolean ok = rows.stream().limit(5).anyMatch(r -> !r.isEmpty() && r.get(0).contains("월말 정산"));
        if (!ok) throw new IllegalStateException("'" + tab + "' 탭이 없거나 이름이 바뀌었습니다");
        return rows;
    }

    // ───────────────────────── 조립 ─────────────────────────

    private Map<String, Object> build(Long companyId, Cached cached) {
        SettleSheetParser.Result r = cached.result();
        Map<String, Row> p = r.pnl();
        int year = r.year() != null ? r.year() : LocalDate.now(KST).getYear();
        YearMonth nowYm = YearMonth.now(KST);
        int lastMonth = year < nowYm.getYear() ? 12 : year > nowYm.getYear() ? 0 : nowYm.getMonthValue();

        List<Map<String, Object>> months = new ArrayList<>();
        BigDecimal ytdOwn = BigDecimal.ZERO, ytdTotal = BigDecimal.ZERO, ytdContribution = BigDecimal.ZERO,
                ytdFixed = BigDecimal.ZERO, ytdOp = BigDecimal.ZERO, ytdDash = BigDecimal.ZERO;
        int estimateMonths = 0;

        for (int m = 0; m < 12; m++) {
            YearMonth ym = YearMonth.of(year, m + 1);
            BigDecimal own = v(p.get("ownRevenue"), m);
            BigDecimal other = v(p.get("otherRevenue"), m);
            BigDecimal total = v(p.get("totalRevenue"), m);
            BigDecimal cogs = v(p.get("cogs"), m);
            BigDecimal ad = v(p.get("adCost"), m);
            BigDecimal logistics = v(p.get("logisticsCost"), m);
            BigDecimal otherCost = v(p.get("otherCost"), m);
            BigDecimal mallFee = v(p.get("mallFee"), m);
            BigDecimal sgna = v(p.get("sgna"), m);
            BigDecimal gross = v(p.get("grossProfit"), m);
            BigDecimal op = v(p.get("operatingProfit"), m);

            String adBasis = SettleSheetParser.basisOf(p.get("adCost"), m, own);
            String logisticsBasis = SettleSheetParser.basisOf(p.get("logisticsCost"), m, own);
            String sgnaBasis = SettleSheetParser.basisOf(p.get("sgna"), m, own);

            // 자사브랜드 공헌이익 = 매출이익 − 판매 변동비 (판관비 비율 가정은 쓰지 않음)
            BigDecimal variable = nz(ad).add(nz(logistics)).add(nz(otherCost)).add(nz(mallFee));
            BigDecimal contribution = gross == null ? null : gross.subtract(variable);

            boolean active = m + 1 <= lastMonth && (nz(total).signum() != 0 || nz(own).signum() != 0);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("month", ym.toString());
            row.put("active", active);
            row.put("ownRevenue", own);
            row.put("otherRevenue", other);
            row.put("totalRevenue", total);
            row.put("cogs", cogs);
            row.put("cogsPct", pct(cogs, own));
            row.put("adCost", ad);
            row.put("adBasis", adBasis);
            row.put("logisticsCost", logistics);
            row.put("logisticsBasis", logisticsBasis);
            row.put("otherCost", otherCost);
            row.put("mallFee", mallFee);
            row.put("sgna", sgna);
            row.put("sgnaBasis", sgnaBasis);
            row.put("grossProfit", gross);
            row.put("grossMarginPct", pct(gross, own));
            row.put("operatingProfit", op);
            row.put("operatingMarginPct", pct(op, own));
            row.put("contribution", contribution);
            row.put("contributionMarginPct", pct(contribution, own));
            boolean estimated = "ESTIMATE".equals(adBasis) || "ESTIMATE".equals(logisticsBasis);
            row.put("contributionBasis", estimated ? "ESTIMATE" : "ACTUAL");

            if (active) {
                // 대시보드 측 같은 달 수치 (대사·실제 고정비)
                LocalDate from = ym.atDay(1);
                LocalDate to = ym.equals(nowYm) ? LocalDate.now(KST) : ym.atEndOfMonth();
                Map<String, Object> d;
                try {
                    d = cfoFinanceService.periodFinancials(companyId, from, to);
                } catch (Exception e) {
                    log.warn("[SettleAutoSheet] 대시보드 손익 조회 실패 {}: {}", ym, e.getMessage());
                    d = Map.of();
                }
                BigDecimal dashNet = dec(d.get("netSales"));
                BigDecimal consulting = dec(d.get("consultingRevenue"));
                BigDecimal dashProduct = dashNet.subtract(consulting);
                BigDecimal fixed = dec(d.get("fixedCost"));
                BigDecimal gap = dashProduct.subtract(nz(total));

                Map<String, Object> dash = new LinkedHashMap<>();
                dash.put("productSales", dashProduct);
                dash.put("consultingRevenue", consulting);
                dash.put("fixedCost", fixed);
                dash.put("gap", gap);
                dash.put("gapPct", pct(gap, total));
                dash.put("gapAlert", total != null && total.signum() != 0
                        && gap.abs().multiply(BigDecimal.valueOf(100))
                        .compareTo(total.abs().multiply(GAP_ALERT_PCT)) > 0);
                row.put("dashboard", dash);

                // 판관비 40% 가정 대신 실제 고정비로 본 영업이익 (자사브랜드 기준)
                BigDecimal adjOp = contribution == null ? null : contribution.subtract(fixed);
                row.put("fixedCost", fixed);
                row.put("fixedCoveragePct", pct(contribution, fixed));
                row.put("adjustedOperatingProfit", adjOp);

                ytdOwn = ytdOwn.add(nz(own));
                ytdTotal = ytdTotal.add(nz(total));
                ytdContribution = ytdContribution.add(nz(contribution));
                ytdFixed = ytdFixed.add(fixed);
                ytdOp = ytdOp.add(nz(op));
                ytdDash = ytdDash.add(dashProduct);
                if (estimated || "ESTIMATE".equals(sgnaBasis)) estimateMonths++;
            }
            months.add(row);
        }

        Map<String, Object> ytd = new LinkedHashMap<>();
        ytd.put("ownRevenue", ytdOwn);
        ytd.put("totalRevenue", ytdTotal);
        ytd.put("contribution", ytdContribution);
        ytd.put("contributionMarginPct", pct(ytdContribution, ytdOwn));
        ytd.put("fixedCost", ytdFixed);
        ytd.put("fixedCoveragePct", pct(ytdContribution, ytdFixed));
        ytd.put("adjustedOperatingProfit", ytdContribution.subtract(ytdFixed));
        ytd.put("sheetOperatingProfit", ytdOp);
        ytd.put("dashboardProductSales", ytdDash);
        ytd.put("gap", ytdDash.subtract(ytdTotal));
        ytd.put("gapPct", pct(ytdDash.subtract(ytdTotal), ytdTotal));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("available", true);
        out.put("year", year);
        out.put("lastMonth", lastMonth);
        out.put("fetchedAt", cached.fetchedAt().atZone(KST).toLocalDateTime().toString());
        out.put("source", source());
        out.put("sheetWarnings", r.warnings());
        out.put("estimateMonths", estimateMonths);
        out.put("months", months);
        out.put("ytd", ytd);
        out.put("brands", seriesRows(r.brands()));
        out.put("skus", seriesRows(r.skus()));
        out.put("sections", sections(r));
        out.put("insights", insights(months, ytd, lastMonth, year));
        out.put("basis", Map.of(
                "contribution", "시트 매출이익(자사매출 − 원가) − 광고비 − 물류비 − 기타·외주 − 쇼핑몰수수료",
                "adjustedOperatingProfit", "자사브랜드 공헌이익 − 대시보드 고정비(반복 고정비 + 운영비 FIXED). 시트 판관비 40% 가정 미사용",
                "estimate", "값 = 자사매출 × 시트 B열 비율이면 '추정(비율 가정)' — 실제 지출 입력이 없는 달",
                "gap", "대시보드 상품매출(주문 순매출 + 수기입력, 컨설팅 제외) − 시트 전체 매출",
                "sheetOperatingProfit", "시트 원본 영업이익(판관비 40% 가정 포함) — 참고용"));
        return out;
    }

    /** 규칙 기반 CFO 코멘트 — 숫자로만 말한다. */
    private List<String> insights(List<Map<String, Object>> months, Map<String, Object> ytd, int lastMonth, int year) {
        List<String> lines = new ArrayList<>();
        // 마지막 '마감된' 달 = 진행 중인 이번 달 이전
        Map<String, Object> closed = null;
        for (int i = Math.min(lastMonth, 12) - 1; i >= 0; i--) {
            Map<String, Object> mrow = months.get(i);
            if (Boolean.TRUE.equals(mrow.get("active")) && i + 1 < lastMonth) { closed = mrow; break; }
        }
        if (closed != null) {
            String mm = String.valueOf(closed.get("month"));
            BigDecimal cov = (BigDecimal) closed.get("fixedCoveragePct");
            BigDecimal adj = (BigDecimal) closed.get("adjustedOperatingProfit");
            if (cov != null) {
                lines.add(mm + " 자사브랜드 공헌이익이 실제 고정비의 " + cov.setScale(0, RoundingMode.HALF_UP)
                        + "%를 커버했습니다 (조정 영업이익 " + won(adj) + ").");
            }
            BigDecimal cogsPct = (BigDecimal) closed.get("cogsPct");
            if (cogsPct != null && cogsPct.compareTo(BigDecimal.valueOf(40)) > 0) {
                lines.add(mm + " 원가율 " + cogsPct.setScale(1, RoundingMode.HALF_UP) + "% — 40% 초과. 가격·구성·생산단가 점검 대상입니다.");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> dash = (Map<String, Object>) closed.get("dashboard");
            if (dash != null && Boolean.TRUE.equals(dash.get("gapAlert"))) {
                lines.add(mm + " 대시보드 매출과 시트 매출이 " + won((BigDecimal) dash.get("gap")) + " ("
                        + ((BigDecimal) dash.get("gapPct")).setScale(1, RoundingMode.HALF_UP)
                        + "%) 다릅니다. 매출 원본을 하나로 확정하기 전까지 손익 판단에 주의하세요.");
            }
            if ("ESTIMATE".equals(closed.get("adBasis")) || "ESTIMATE".equals(closed.get("logisticsBasis"))) {
                lines.add(mm + " 광고비·물류비 중 비율 가정(추정)으로 채워진 항목이 있습니다. 실제 집행액을 입력하면 공헌이익이 확정됩니다.");
            }
        }
        BigDecimal ytdCov = (BigDecimal) ytd.get("fixedCoveragePct");
        if (ytdCov != null) {
            lines.add(year + "년 누적 고정비 커버율 " + ytdCov.setScale(0, RoundingMode.HALF_UP)
                    + "% · 누적 조정 영업이익 " + won((BigDecimal) ytd.get("adjustedOperatingProfit")) + ".");
        }
        return lines;
    }

    private List<Map<String, Object>> seriesRows(List<Row> rows) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Row row : rows) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("label", row.label());
            m.put("note", row.note());
            m.put("unitValue", row.notePercent() ? null : row.noteValue());
            m.put("months", java.util.Arrays.asList(row.months()));
            m.put("total", row.total());
            out.add(m);
        }
        return out;
    }

    private List<Map<String, Object>> sections(SettleSheetParser.Result r) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (SettleSheetParser.Section s : r.sections()) {
            if (s.title().equals("손익") || s.rows().isEmpty()) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("title", s.title());
            m.put("percent", s.rows().stream().allMatch(x -> x.total() == null || x.total().abs().compareTo(BigDecimal.valueOf(1000)) < 0)
                    && s.title().contains("비중"));
            m.put("rows", seriesRows(s.rows()));
            out.add(m);
        }
        return out;
    }

    private Map<String, Object> source() {
        return Map.of("sheetId", SheetSalesPullService.DEFAULT_SHEET_ID, "tab", TAB,
                "mode", "READ_ONLY", "cacheMinutes", TTL.toMinutes());
    }

    // ───────────────────────── utils ─────────────────────────

    private static BigDecimal v(Row row, int m) {
        return row == null ? null : row.months()[m];
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static BigDecimal dec(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal b) return b;
        try { return new BigDecimal(o.toString()); } catch (Exception e) { return BigDecimal.ZERO; }
    }

    private static BigDecimal pct(BigDecimal a, BigDecimal b) {
        if (a == null || b == null || b.signum() == 0) return null;
        return FinanceCalculator.ratioPct(a, b);
    }

    private static String won(BigDecimal v) {
        if (v == null) return "—";
        return String.format("%,d원", v.setScale(0, RoundingMode.HALF_UP).longValue());
    }
}
