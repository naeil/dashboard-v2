package naeil.dashboard.common.finance;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 구글시트 '월말정산_자동' 탭(월말 정산 대시보드) 파서.
 *
 * 시트 구조(읽기 전용, 시트는 절대 수정하지 않는다):
 *  - "연도" 행 → 연도
 *  - "⚠ ..." 행 → 시트 자체 경고
 *  - "항목" 헤더 행 → "1월".."12월" 열 위치 (그 다음 열 = 연간 합계)
 *  - 값이 없는 라벨 행 = 섹션 제목 (예: "매출 대비 비중", "채널별 매출 (자사브랜드)")
 *  - 2번째 열(B) = 단가(판매 수량 섹션) 또는 비율 가정(광고비 10% 등)
 *
 * 순수 함수 — 네트워크/DB 의존 없음. 단위 테스트 대상.
 */
public final class SettleSheetParser {

    private static final Pattern MONTH = Pattern.compile("^\\s*(\\d{1,2})\\s*월\\s*$");
    private static final Pattern NUMBER = Pattern.compile("-?[0-9][0-9,]*(\\.[0-9]+)?");

    /** 손익 블록의 라벨 → 키 (시트 라벨이 조금 바뀌어도 contains 로 매칭) */
    private static final String[][] PNL_LABELS = {
            {"ownRevenue", "매출 (자사브랜드)"},
            {"otherRevenue", "기타사업 매출"},
            {"totalRevenue", "전체 매출"},
            {"quantity", "판매 수량"},
            {"cogs", "원가"},
            {"adCost", "광고비"},
            {"logisticsCost", "물류비"},
            {"otherCost", "기타·외주"},
            {"mallFee", "쇼핑몰수수료"},
            {"sgna", "판관비"},
            {"grossProfit", "매출이익"},
            {"operatingProfit", "영업이익"},
    };

    private SettleSheetParser() {
    }

    /** 한 행 = 라벨 + B열(단가/비율) + 1~12월 값 + 합계 */
    public record Row(String label, String note, BigDecimal noteValue, boolean notePercent,
                      BigDecimal[] months, BigDecimal total) {
        public boolean hasValues() {
            for (BigDecimal m : months) if (m != null) return true;
            return total != null;
        }
    }

    public record Section(String title, List<Row> rows) {
    }

    public record Result(Integer year, List<String> warnings, Map<String, Row> pnl,
                         List<Row> brands, List<Row> skus, List<Section> sections) {
    }

    public static Result parse(List<List<String>> csv) {
        if (csv == null || csv.isEmpty()) {
            throw new IllegalArgumentException("시트가 비어 있습니다.");
        }
        Integer year = null;
        List<String> warnings = new ArrayList<>();
        int[] monthCol = null;
        int totalCol = -1;
        int headerIdx = -1;

        for (int i = 0; i < csv.size(); i++) {
            List<String> r = csv.get(i);
            String first = cell(r, 0);
            if (first.startsWith("연도")) {
                BigDecimal y = number(cell(r, 1));
                if (y != null) year = y.intValue();
            } else if (first.startsWith("⚠")) {
                warnings.add(first);
            } else if (first.equals("항목")) {
                monthCol = new int[12];
                java.util.Arrays.fill(monthCol, -1);
                int last = -1;
                for (int c = 1; c < r.size(); c++) {
                    Matcher m = MONTH.matcher(cell(r, c));
                    if (m.matches()) {
                        int mm = Integer.parseInt(m.group(1));
                        if (mm >= 1 && mm <= 12) {
                            monthCol[mm - 1] = c;
                            last = Math.max(last, c);
                        }
                    }
                }
                totalCol = last >= 0 ? last + 1 : -1;
                headerIdx = i;
                break;
            }
        }
        if (monthCol == null || monthCol[0] < 0) {
            throw new IllegalArgumentException("'항목 / 1월~12월' 헤더 행을 찾지 못했습니다. 시트 구조가 바뀌었는지 확인하세요.");
        }

        Map<String, Row> pnl = new LinkedHashMap<>();
        List<Row> brands = new ArrayList<>();
        List<Row> skus = new ArrayList<>();
        List<Section> sections = new ArrayList<>();
        Section current = new Section("손익", new ArrayList<>());
        sections.add(current);
        boolean pnlOpen = true;          // "매출 대비 비중" 이전까지가 손익 블록
        String block = "";               // 손익 블록 안의 하위 구분 (revenue / quantity)

        for (int i = headerIdx + 1; i < csv.size(); i++) {
            List<String> r = csv.get(i);
            String label = cell(r, 0);
            if (label.isEmpty() || label.startsWith("⚠")) continue;
            Row row = toRow(r, label, monthCol, totalCol);

            if (!row.hasValues()) {
                // 섹션 제목 행 ("매핑 점검" 처럼 값 없는 점검 행 포함)
                if (label.contains("점검")) continue;
                pnlOpen = false;
                current = new Section(label, new ArrayList<>());
                sections.add(current);
                continue;
            }
            current.rows().add(row);
            if (!pnlOpen) continue;

            String key = pnlKey(label);
            if (key != null && !pnl.containsKey(key)) {
                pnl.put(key, row);
                if (key.equals("ownRevenue")) block = "revenue";
                else if (key.equals("quantity")) block = "quantity";
                else block = "";
                continue;
            }
            if (block.equals("revenue")) brands.add(row);
            else if (block.equals("quantity")) skus.add(row);
        }
        return new Result(year, warnings, pnl, brands, skus, sections);
    }

    /**
     * 비율 가정 판정: 값 ≈ 기준매출 × B열 비율이면 '추정(비율 가정)', 아니면 '실측'.
     * 시트는 실제 금액이 없을 때 비율로 채우기 때문에 이 구분이 없으면 추정치가 실측처럼 보인다.
     */
    public static String basisOf(Row row, int monthIndex, BigDecimal base) {
        if (row == null) return "MISSING";
        BigDecimal v = row.months()[monthIndex];
        if (v == null) return "MISSING";
        if (!row.notePercent() || row.noteValue() == null || base == null || base.signum() == 0) {
            return v.signum() == 0 ? "ZERO" : "ACTUAL";
        }
        BigDecimal expected = base.multiply(row.noteValue()).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
        BigDecimal tolerance = base.abs().multiply(new BigDecimal("0.0005")).max(BigDecimal.valueOf(2));
        return v.subtract(expected).abs().compareTo(tolerance) <= 0 ? "ESTIMATE" : "ACTUAL";
    }

    // ───────────────────────── helpers ─────────────────────────

    private static String pnlKey(String label) {
        String norm = label.replace(" ", "");
        for (String[] p : PNL_LABELS) {
            String target = p[1].replace(" ", "");
            boolean match = p[0].equals("cogs") ? norm.equals("원가")
                    : p[0].equals("operatingProfit") ? norm.equals("영업이익")
                    : p[0].equals("grossProfit") ? norm.equals("매출이익")
                    : p[0].equals("adCost") ? norm.equals("광고비")
                    : p[0].equals("logisticsCost") ? norm.equals("물류비")
                    : p[0].equals("sgna") ? norm.equals("판관비")
                    : norm.startsWith(target);
            if (match) return p[0];
        }
        return null;
    }

    private static Row toRow(List<String> r, String label, int[] monthCol, int totalCol) {
        BigDecimal[] months = new BigDecimal[12];
        for (int m = 0; m < 12; m++) {
            months[m] = monthCol[m] >= 0 ? number(cell(r, monthCol[m])) : null;
        }
        String note = cell(r, 1);
        BigDecimal total = totalCol >= 0 ? number(cell(r, totalCol)) : null;
        return new Row(label, note, number(note), note.contains("%"), months, total);
    }

    static String cell(List<String> r, int i) {
        if (r == null || i < 0 || i >= r.size()) return "";
        String v = r.get(i);
        return v == null ? "" : v.trim();
    }

    /** "₩2,737,340" / "-₩3,130,744" / "10%" / "1,475" / "" → BigDecimal (빈칸·'-' 은 null) */
    public static BigDecimal number(String s) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty() || t.equals("-") || t.equals("—")) return null;
        boolean negative = t.startsWith("-") || t.startsWith("(") || t.startsWith("−");
        Matcher m = NUMBER.matcher(t.replace("−", "-"));
        if (!m.find()) return null;
        String digits = m.group().replace(",", "").replace("-", "");
        try {
            BigDecimal v = new BigDecimal(digits);
            return negative ? v.negate() : v;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
