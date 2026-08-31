package naeil.dashboard.service;

import java.io.ByteArrayInputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.entity.AiReview;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;

/**
 * 실제 후기 엑셀/CSV 업로드 → ai_reviews 적재.
 * 네이버·쿠팡 모두 공식 리뷰 API가 없어(2024~ 공식 확인) 판매자센터에서 내려받은
 * 리뷰 파일을 업로드하는 방식으로 실데이터를 수집한다. 헤더 키워드 기반 자동 매핑이라
 * 스마트스토어/쿠팡/기타 채널의 서로 다른 양식을 모두 처리한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewUploadService {

    private final AiReviewService aiReviewService;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    public Map<String, Object> importFile(byte[] bytes, String filename, String channel) {
        if (bytes == null || bytes.length == 0) {
            return Map.of("success", false, "message", "파일이 비어 있습니다.");
        }
        String ch = channel == null || channel.isBlank() ? "직접 업로드" : channel.trim();
        List<List<String>> rows;
        try {
            String lower = filename == null ? "" : filename.toLowerCase();
            rows = lower.endsWith(".csv") || lower.endsWith(".txt") ? readCsv(bytes) : readExcel(bytes);
        } catch (Exception e) {
            log.warn("[ReviewUpload] 파일 파싱 실패: {}", e.getMessage());
            return Map.of("success", false, "message", "파일을 읽지 못했습니다. 엑셀(.xlsx) 또는 CSV 형식인지 확인하세요.");
        }
        if (rows.size() < 2) {
            return Map.of("success", false, "message", "데이터 행이 없습니다.");
        }

        ColumnMap cols = detectColumns(rows);
        if (cols == null) {
            return Map.of("success", false, "message",
                    "리뷰 형식을 인식하지 못했습니다. 평점과 리뷰 내용 열이 포함된 판매자센터 리뷰 파일인지 확인하세요.");
        }

        // 1) 파싱 (메모리) — 파일 내 중복 review_id 는 첫 행만 유지
        int skipped = 0;
        Map<String, AiReview> parsed = new LinkedHashMap<>();
        for (int i = cols.headerRow + 1; i < rows.size(); i++) {
            List<String> r = rows.get(i);
            String content = cell(r, cols.content);
            Integer rating = parseRating(cell(r, cols.rating));
            if (content.isEmpty() || rating == null) { skipped++; continue; }
            LocalDateTime date = parseDate(cell(r, cols.date));
            String product = cell(r, cols.product);
            String option = cell(r, cols.option);
            String author = cell(r, cols.author);
            String orderNo = cell(r, cols.orderNo);
            String reviewNo = cell(r, cols.reviewNo);
            String reviewId = !reviewNo.isEmpty()
                    ? "UP-" + reviewNo
                    : "UP-" + sha1(ch + "|" + (date == null ? "" : date.toLocalDate()) + "|" + author + "|" + product + "|" + content).substring(0, 24);

            parsed.putIfAbsent(reviewId, AiReview.builder()
                    .reviewId(reviewId)
                    .channel(ch)
                    .brand(inferBrand(ch, product))
                    .productName(product.isEmpty() ? null : truncate(product, 490))
                    .optionName(option.isEmpty() ? null : truncate(option, 490))
                    .rating(rating)
                    .reviewContent(content)
                    .reviewDate(date == null ? LocalDateTime.now() : date)
                    .customerName(author.isEmpty() ? null : truncate(author, 90))
                    .orderNumber(orderNo.isEmpty() ? null : truncate(orderNo, 250))
                    .build());
        }

        // 2) 기존 review_id 일괄 조회 (쿼리 1번) → 중복 제외
        java.util.Set<String> existing = new java.util.HashSet<>(jdbcTemplate.queryForList(
                "SELECT review_id FROM ai_reviews WHERE channel = ?", String.class, ch));
        List<AiReview> fresh = parsed.values().stream().filter(r -> !existing.contains(r.getReviewId())).toList();
        int duplicated = parsed.size() - fresh.size();
        int added = fresh.size();

        if (!fresh.isEmpty()) {
            // 3) 리뷰 배치 INSERT (쿼리 1번)
            jdbcTemplate.batchUpdate("""
                    INSERT INTO ai_reviews (review_id, channel, brand, product_name, option_name,
                                            rating, review_content, review_date, customer_name, order_number)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (channel, review_id) DO NOTHING
                    """, fresh, 200, (ps, r) -> {
                ps.setString(1, r.getReviewId());
                ps.setString(2, r.getChannel());
                ps.setString(3, r.getBrand());
                ps.setString(4, r.getProductName());
                ps.setString(5, r.getOptionName());
                ps.setInt(6, r.getRating());
                ps.setString(7, r.getReviewContent());
                ps.setTimestamp(8, java.sql.Timestamp.valueOf(r.getReviewDate()));
                ps.setString(9, r.getCustomerName());
                ps.setString(10, r.getOrderNumber());
            });

            // 4) 방금 넣은 id 매핑 조회 (쿼리 1번)
            Map<String, Long> idByReviewId = new java.util.HashMap<>();
            jdbcTemplate.query("SELECT id, review_id FROM ai_reviews WHERE channel = ?",
                    rs -> { idByReviewId.put(rs.getString("review_id"), rs.getLong("id")); }, ch);

            // 5) 분석 결과 메모리 계산 → 배치 INSERT (쿼리 1번)
            List<Object[]> analyses = new ArrayList<>();
            for (AiReview r : fresh) {
                Long id = idByReviewId.get(r.getReviewId());
                if (id == null) continue;
                var a = aiReviewService.buildAnalysis(r);
                analyses.add(new Object[]{
                        id, a.getSentiment(), a.getIsUrgent(), a.getUrgentKeywords(), a.getKeywords(),
                        a.getReplyDraft(), a.getReplyStatus(), "COMPLETED",
                        java.sql.Timestamp.valueOf(java.time.LocalDateTime.now())
                });
            }
            jdbcTemplate.batchUpdate("""
                    INSERT INTO ai_review_analyses (review_id, sentiment, is_urgent, urgent_keywords, keywords,
                                                    reply_draft, reply_status, analysis_status, analyzed_at)
                    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
                    WHERE NOT EXISTS (SELECT 1 FROM ai_review_analyses WHERE review_id = ?)
                    """, analyses.stream().map(a -> new Object[]{
                        a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[0]
                    }).toList());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("channel", ch);
        result.put("added", added);
        result.put("duplicated", duplicated);
        result.put("skipped", skipped);
        result.put("message", "신규 " + added + "건 등록" + (duplicated > 0 ? ", 중복 " + duplicated + "건 제외" : "")
                + (skipped > 0 ? ", 형식 불일치 " + skipped + "행 건너뜀" : ""));
        return result;
    }

    /* ───────── 컬럼 자동 인식 ───────── */

    private record ColumnMap(int headerRow, int rating, int content, int date, int product,
                             int option, int author, int orderNo, int reviewNo) { }

    private ColumnMap detectColumns(List<List<String>> rows) {
        int limit = Math.min(rows.size(), 10);
        for (int h = 0; h < limit; h++) {
            List<String> header = rows.get(h);
            int rating = find(header, "평점", "별점", "만족도", "점수", "rating", "star");
            int content = find(header, "리뷰내용", "리뷰 내용", "상품평 내용", "상품평내용", "후기내용", "내용", "리뷰", "상품평", "후기", "content");
            if (rating < 0 || content < 0 || rating == content) continue;
            int date = find(header, "작성일", "등록일", "작성 일", "리뷰등록일", "작성일자", "등록일자", "date");
            int product = find(header, "상품명", "등록상품명", "노출상품명", "상품 명", "product", "상품");
            int option = find(header, "옵션정보", "옵션명", "옵션", "option");
            int author = find(header, "작성자", "구매자명", "구매자", "아이디", "작성자ID", "구매자ID", "고객명", "writer");
            int orderNo = find(header, "주문번호", "order");
            int reviewNo = find(header, "리뷰번호", "상품평번호", "상품평ID", "리뷰ID", "리뷰 번호", "reviewid");
            return new ColumnMap(h, rating, content, date, product, option, author, orderNo, reviewNo);
        }
        return null;
    }

    private static int find(List<String> header, String... keywords) {
        for (String keyword : keywords) {
            String k = keyword.toLowerCase().replace(" ", "");
            for (int i = 0; i < header.size(); i++) {
                String cell = header.get(i) == null ? "" : header.get(i).toLowerCase().replace(" ", "");
                if (!cell.isEmpty() && cell.contains(k)) return i;
            }
        }
        return -1;
    }

    /* ───────── 값 파싱 ───────── */

    private static Integer parseRating(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        long stars = v.chars().filter(c -> c == '★').count();
        if (stars >= 1 && stars <= 5) return (int) stars;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("([1-5])(?:\\.0)?").matcher(v);
        if (m.find()) return Integer.parseInt(m.group(1));
        return null;
    }

    private static LocalDateTime parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim().replaceAll("[./]", "-");
        try {
            if (v.matches("\\d{8}")) return LocalDate.parse(v.substring(0, 4) + "-" + v.substring(4, 6) + "-" + v.substring(6, 8)).atTime(12, 0);
            if (v.length() >= 16 && v.charAt(10) == ' ') {
                return LocalDateTime.parse(v.substring(0, 16).replace(' ', 'T'));
            }
            if (v.length() >= 10) return LocalDate.parse(v.substring(0, 10)).atTime(12, 0);
        } catch (Exception ignored) {
            // 인식 불가한 날짜는 null → 업로드 시각 사용
        }
        return null;
    }

    private static String inferBrand(String channel, String product) {
        String base = (channel + " " + (product == null ? "" : product));
        if (base.contains("국민한상")) return "국민한상";
        if (base.contains("프리하닭")) return "프리하닭";
        if (base.contains("하이프리") || base.contains("단백깡") || base.contains("당근효소")) return "하이프리";
        if (channel.contains("쿠팡")) return "하이프리";
        return "기타";
    }

    /* ───────── 파일 읽기 ───────── */

    private static List<List<String>> readExcel(byte[] bytes) throws Exception {
        List<List<String>> rows = new ArrayList<>();
        DataFormatter formatter = new DataFormatter();
        try (Workbook wb = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            Sheet sheet = wb.getSheetAt(0);
            for (Row row : sheet) {
                List<String> cells = new ArrayList<>();
                short last = row.getLastCellNum();
                for (int c = 0; c < last; c++) {
                    Cell cell = row.getCell(c);
                    if (cell == null) { cells.add(""); continue; }
                    if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                        cells.add(cell.getLocalDateTimeCellValue().toString());
                    } else {
                        cells.add(formatter.formatCellValue(cell));
                    }
                }
                rows.add(cells);
            }
        }
        return rows;
    }

    private static List<List<String>> readCsv(byte[] bytes) {
        String text = decode(bytes);
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') { cur.append('"'); i++; }
                    else quoted = false;
                } else cur.append(c);
            } else {
                if (c == '"') quoted = true;
                else if (c == ',') { row.add(cur.toString()); cur.setLength(0); }
                else if (c == '\n') { row.add(cur.toString()); rows.add(row); row = new ArrayList<>(); cur.setLength(0); }
                else if (c != '\r') cur.append(c);
            }
        }
        if (cur.length() > 0 || !row.isEmpty()) { row.add(cur.toString()); rows.add(row); }
        return rows;
    }

    /** UTF-8(BOM 포함) 우선, 한글 깨짐이 감지되면 EUC-KR 재시도 */
    private static String decode(byte[] bytes) {
        byte[] body = bytes;
        if (bytes.length >= 3 && (bytes[0] & 0xFF) == 0xEF && (bytes[1] & 0xFF) == 0xBB && (bytes[2] & 0xFF) == 0xBF) {
            body = java.util.Arrays.copyOfRange(bytes, 3, bytes.length);
            return new String(body, StandardCharsets.UTF_8);
        }
        String utf8 = new String(body, StandardCharsets.UTF_8);
        if (utf8.contains("�")) {
            try {
                return new String(body, Charset.forName("EUC-KR"));
            } catch (Exception ignored) {
                // EUC-KR 미지원 환경이면 UTF-8 결과 사용
            }
        }
        return utf8;
    }

    private static String cell(List<String> row, int idx) {
        if (idx < 0 || idx >= row.size()) return "";
        String v = row.get(idx);
        return v == null ? "" : v.trim();
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String sha1(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                String h = Integer.toHexString(0xff & b);
                if (h.length() == 1) sb.append('0');
                sb.append(h);
            }
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(input.hashCode());
        }
    }
}
