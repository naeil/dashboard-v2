package naeil.dashboard.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.dto.PayrollDto;
import naeil.dashboard.entity.PayrollRecord;
import naeil.dashboard.repository.PayrollRecordRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.*;
import java.util.LinkedHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayrollService {

    private static final Long DEFAULT_COMPANY_ID = 1L;

    private final PayrollRecordRepository payrollRecordRepository;
    private final JavaMailSender mailSender;
    private final JdbcTemplate jdbcTemplate;

    @Value("${app.mail.from}")
    private String mailFrom;

    // ──────────────────────────────────────────────
    // 엑셀 업로드 & 파싱
    // ──────────────────────────────────────────────

    @Transactional
    public PayrollDto.UploadResult uploadExcel(MultipartFile file, String payYearMonth) throws Exception {
        List<PayrollRecord> records = parseExcel(file, payYearMonth);
        int imported = 0;
        List<String> skipped = new ArrayList<>();

        for (PayrollRecord record : records) {
            boolean exists = payrollRecordRepository
                    .existsByCompanyIdAndPayYearMonthAndEmployeeName(
                            DEFAULT_COMPANY_ID, payYearMonth, record.getEmployeeName());
            if (exists) {
                skipped.add(record.getEmployeeName());
                continue;
            }
            // 직원 계정 자동 매칭 (display_name 기준)
            Long userId = findUserIdByName(record.getEmployeeName());
            PayrollRecord toSave = PayrollRecord.builder()
                    .companyId(DEFAULT_COMPANY_ID)
                    .payYearMonth(payYearMonth)
                    .employeeName(record.getEmployeeName())
                    .userId(userId)
                    .baseSalary(record.getBaseSalary())
                    .mealAllowance(record.getMealAllowance())
                    .transportAllowance(record.getTransportAllowance())
                    .otherAllowance(record.getOtherAllowance())
                    .totalPayment(record.getTotalPayment())
                    .deductionNationalPension(record.getDeductionNationalPension())
                    .deductionHealthInsurance(record.getDeductionHealthInsurance())
                    .deductionLongTermCare(record.getDeductionLongTermCare())
                    .deductionEmploymentInsurance(record.getDeductionEmploymentInsurance())
                    .deductionIncomeTax(record.getDeductionIncomeTax())
                    .deductionLocalIncomeTax(record.getDeductionLocalIncomeTax())
                    .totalDeduction(record.getTotalDeduction())
                    .netPay(record.getNetPay())
                    .build();
            payrollRecordRepository.save(toSave);
            imported++;
        }

        return new PayrollDto.UploadResult(records.size(), imported, skipped.size(), skipped);
    }

    private List<PayrollRecord> parseExcel(MultipartFile file, String payYearMonth) throws Exception {
        List<PayrollRecord> result = new ArrayList<>();
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            // 직원별 시트 구조: 각 시트가 한 명의 급여명세서
            for (int s = 0; s < workbook.getNumberOfSheets(); s++) {
                Sheet sheet = workbook.getSheetAt(s);
                PayrollRecord record = parsePayslipSheet(sheet, payYearMonth);
                if (record != null) result.add(record);
            }
        }
        return result;
    }

    /**
     * 급여명세서 양식 시트 파싱 (셀 레이블 스캔 방식)
     * 직원별 시트: 성명은 "성 명 :" 형식, 금액은 레이블 오른쪽 임의 열에 위치
     */
    private PayrollRecord parsePayslipSheet(Sheet sheet, String payYearMonth) {
        Map<String, BigDecimal> moneyMap = new LinkedHashMap<>();
        String employeeName = null;

        for (int r = 0; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;

            for (Cell cell : row) {
                String raw = getCellString(cell);
                if (raw == null || raw.isBlank()) continue;

                String normalized = raw.replaceAll("\\s+", ""); // 공백 제거

                // 성명 추출: "성명" 포함 셀
                if (employeeName == null && normalized.contains("성명")) {
                    // 콜론 뒤에 이름이 같은 셀에 있는 경우: "성명:홍길동"
                    if (normalized.contains(":")) {
                        String afterColon = normalized.substring(normalized.indexOf(":") + 1).trim();
                        if (!afterColon.isBlank()) {
                            employeeName = afterColon;
                            continue;
                        }
                    }
                    // 이름이 다음 셀에 있는 경우
                    employeeName = findNextNonEmptyString(row, cell.getColumnIndex() + 1);
                    continue;
                }

                // 레이블 키 정규화 (공백 제거)
                String key = normalized;

                // 금액: 같은 행에서 오른쪽으로 숫자 탐색 (최대 20열)
                BigDecimal amount = findNextNumericValue(row, cell.getColumnIndex() + 1, 20);
                if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
                    moneyMap.putIfAbsent(key, amount);
                }
            }
        }

        if (employeeName == null || employeeName.isBlank()) {
            // 시트 이름으로 대체 시도
            String sheetName = sheet.getSheetName();
            if (sheetName != null && !sheetName.isBlank()) {
                // 시트명에서 숫자/괄호 제거 (예: "유승우(1)" → "유승우")
                employeeName = sheetName.replaceAll("[\\(\\)\\d]", "").trim();
            }
            if (employeeName == null || employeeName.isBlank()) return null;
        }

        return PayrollRecord.builder()
                .companyId(DEFAULT_COMPANY_ID)
                .payYearMonth(payYearMonth)
                .employeeName(employeeName.trim())
                .baseSalary(get(moneyMap, "기본급"))
                .mealAllowance(get(moneyMap, "식비", "식대"))
                .transportAllowance(get(moneyMap, "교통비", "차량유지보조금", "차량유지비", "자가운전보조금"))
                .otherAllowance(get(moneyMap, "기타수당", "야간근로수당", "연장수당", "상여"))
                .totalPayment(get(moneyMap, "지급액계", "지급합계", "총지급액"))
                .deductionNationalPension(get(moneyMap, "국민연금"))
                .deductionHealthInsurance(get(moneyMap, "건강보험"))
                .deductionLongTermCare(get(moneyMap, "장기요양보험", "장기요양"))
                .deductionEmploymentInsurance(get(moneyMap, "고용보험"))
                .deductionIncomeTax(get(moneyMap, "소득세", "근로소득세", "갑근세"))
                .deductionLocalIncomeTax(get(moneyMap, "지방소득세"))
                .totalDeduction(get(moneyMap, "공제액계", "공제합계", "총공제액"))
                .netPay(get(moneyMap, "실수령액", "실수령액", "차인지급액", "실지급액"))
                .build();
    }

    private String findNextNonEmptyString(Row row, int startCol) {
        for (int c = startCol; c < startCol + 10; c++) {
            Cell cell = row.getCell(c);
            String val = getCellString(cell);
            if (val != null && !val.isBlank()) {
                String norm = val.replaceAll("\\s+", "");
                // 숫자나 구분자만 있는 셀 제외
                if (!norm.matches("[\\d,.:]+")) return val.trim();
            }
        }
        return null;
    }

    private BigDecimal findNextNumericValue(Row row, int startCol, int maxLook) {
        for (int c = startCol; c < startCol + maxLook; c++) {
            Cell cell = row.getCell(c);
            if (cell == null) continue;
            if (cell.getCellType() == CellType.NUMERIC) {
                double v = cell.getNumericCellValue();
                if (v > 0) return BigDecimal.valueOf(v);
            } else if (cell.getCellType() == CellType.STRING) {
                String s = cell.getStringCellValue().replaceAll("[^0-9]", "");
                if (!s.isBlank()) {
                    try {
                        long v = Long.parseLong(s);
                        if (v > 0) return BigDecimal.valueOf(v);
                    } catch (Exception ignored) {}
                }
            }
        }
        return null;
    }

    private BigDecimal get(Map<String, BigDecimal> map, String... keys) {
        for (String key : keys) {
            BigDecimal val = map.get(key);
            if (val != null) return val;
        }
        return BigDecimal.ZERO;
    }

    private String getCellString(Cell cell) {
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> null;
        };
    }

    // ──────────────────────────────────────────────
    // 조회
    // ──────────────────────────────────────────────

    public List<PayrollDto.RecordResponse> getRecords(String payYearMonth) {
        List<PayrollRecord> records = payYearMonth != null
                ? payrollRecordRepository.findByCompanyIdAndPayYearMonthOrderByEmployeeName(DEFAULT_COMPANY_ID, payYearMonth)
                : payrollRecordRepository.findByCompanyIdOrderByPayYearMonthDescEmployeeNameAsc(DEFAULT_COMPANY_ID);
        return records.stream().map(PayrollDto.RecordResponse::from).toList();
    }

    public List<String> getAvailableMonths() {
        return payrollRecordRepository.findDistinctMonthsByCompanyId(DEFAULT_COMPANY_ID);
    }

    // ──────────────────────────────────────────────
    // 이메일 발송
    // ──────────────────────────────────────────────

    @Transactional
    public PayrollDto.SendResult sendPayslips(String payYearMonth) {
        List<PayrollRecord> records = payrollRecordRepository
                .findByCompanyIdAndPayYearMonthOrderByEmployeeName(DEFAULT_COMPANY_ID, payYearMonth);

        int sent = 0;
        List<String> failed = new ArrayList<>();

        for (PayrollRecord record : records) {
            String email = resolveEmail(record);
            if (email == null || email.isBlank()) {
                log.warn("이메일 없음 - 직원: {}", record.getEmployeeName());
                failed.add(record.getEmployeeName() + " (이메일 미등록)");
                continue;
            }
            try {
                sendPayslipEmail(email, record);
                record.markEmailSent();
                payrollRecordRepository.save(record);
                sent++;
            } catch (Exception e) {
                log.error("이메일 발송 실패 - {}: {}", record.getEmployeeName(), e.getMessage());
                failed.add(record.getEmployeeName());
            }
        }
        return new PayrollDto.SendResult(sent, failed.size(), failed);
    }

    private void sendPayslipEmail(String to, PayrollRecord r) throws Exception {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(mailFrom);
        helper.setTo(to);
        helper.setSubject(String.format("[내일그룹] %s 급여명세서", r.getPayYearMonth()));
        helper.setText(buildEmailHtml(r), true);
        mailSender.send(message);
    }

    private String buildEmailHtml(PayrollRecord r) {
        return """
            <html><body style="font-family:sans-serif;color:#222;">
            <h2 style="color:#0ea5e9;">%s 급여명세서</h2>
            <p>%s님, 안녕하세요. %s 급여명세서를 안내드립니다.</p>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%%;max-width:480px;">
              <tr style="background:#f1f5f9;"><th colspan="2">지급 내역</th></tr>
              <tr><td>기본급</td><td style="text-align:right;">%,d 원</td></tr>
              <tr><td>식대</td><td style="text-align:right;">%,d 원</td></tr>
              <tr><td>교통비</td><td style="text-align:right;">%,d 원</td></tr>
              <tr><td>기타수당</td><td style="text-align:right;">%,d 원</td></tr>
              <tr style="font-weight:bold;background:#e0f2fe;"><td>지급합계</td><td style="text-align:right;">%,d 원</td></tr>
              <tr style="background:#f1f5f9;"><th colspan="2">공제 내역</th></tr>
              <tr><td>국민연금</td><td style="text-align:right;">%,d 원</td></tr>
              <tr><td>건강보험</td><td style="text-align:right;">%,d 원</td></tr>
              <tr><td>장기요양</td><td style="text-align:right;">%,d 원</td></tr>
              <tr><td>고용보험</td><td style="text-align:right;">%,d 원</td></tr>
              <tr><td>소득세</td><td style="text-align:right;">%,d 원</td></tr>
              <tr><td>지방소득세</td><td style="text-align:right;">%,d 원</td></tr>
              <tr style="font-weight:bold;background:#fee2e2;"><td>공제합계</td><td style="text-align:right;">%,d 원</td></tr>
              <tr style="font-weight:bold;font-size:1.1em;background:#dcfce7;"><td>실수령액</td><td style="text-align:right;">%,d 원</td></tr>
            </table>
            <p style="color:#64748b;font-size:0.85em;margin-top:24px;">문의사항은 관리자에게 연락해 주세요.</p>
            </body></html>
            """.formatted(
                r.getPayYearMonth(), r.getEmployeeName(), r.getPayYearMonth(),
                r.getBaseSalary().longValue(),
                r.getMealAllowance().longValue(),
                r.getTransportAllowance().longValue(),
                r.getOtherAllowance().longValue(),
                r.getTotalPayment().longValue(),
                r.getDeductionNationalPension().longValue(),
                r.getDeductionHealthInsurance().longValue(),
                r.getDeductionLongTermCare().longValue(),
                r.getDeductionEmploymentInsurance().longValue(),
                r.getDeductionIncomeTax().longValue(),
                r.getDeductionLocalIncomeTax().longValue(),
                r.getTotalDeduction().longValue(),
                r.getNetPay().longValue()
        );
    }

    // ──────────────────────────────────────────────
    // 매월 10일 9시 자동 발송
    // ──────────────────────────────────────────────

    @Scheduled(cron = "0 0 9 10 * *")
    public void autoSendCurrentMonth() {
        String yearMonth = java.time.YearMonth.now().toString(); // "2026-05"
        log.info("[급여명세서 자동발송] {} 발송 시작", yearMonth);
        try {
            PayrollDto.SendResult result = sendPayslips(yearMonth);
            log.info("[급여명세서 자동발송] 완료 - 발송: {}건, 실패: {}건", result.sent(), result.failed());
        } catch (Exception e) {
            log.error("[급여명세서 자동발송] 오류: {}", e.getMessage());
        }
    }

    // ──────────────────────────────────────────────
    // 직원 이메일 등록/수정
    // ──────────────────────────────────────────────

    @Transactional
    public void updateUserEmail(Long userId, String email) {
        jdbcTemplate.update(
                "UPDATE dashboard_user SET email = ?, updated_at = NOW() WHERE id = ?",
                email, userId);
    }

    // ──────────────────────────────────────────────
    // 헬퍼
    // ──────────────────────────────────────────────

    private Long findUserIdByName(String employeeName) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT id FROM dashboard_user WHERE company_id = ? AND display_name = ? LIMIT 1",
                    Long.class, DEFAULT_COMPANY_ID, employeeName);
        } catch (Exception e) {
            return null;
        }
    }

    private String resolveEmail(PayrollRecord record) {
        if (record.getUserId() == null) return null;
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT email FROM dashboard_user WHERE id = ?",
                    String.class, record.getUserId());
        } catch (Exception e) {
            return null;
        }
    }
}
