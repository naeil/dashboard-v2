package naeil.dashboard.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.dto.PayrollDto;
import naeil.dashboard.entity.PayrollRecord;
import naeil.dashboard.repository.PayrollRecordRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.LinkedHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayrollService {

    private static final Long DEFAULT_COMPANY_ID = 1L;
    private static final Map<Integer, InsuranceRates> INSURANCE_RATES_BY_YEAR = Map.of(
        2025, new InsuranceRates("0.045", "0.03545", "0.1281", "0.009"),
        2026, new InsuranceRates("0.0475", "0.03595", "0.1314", "0.009")
    );

    private final PayrollRecordRepository payrollRecordRepository;
    private final JdbcTemplate jdbcTemplate;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${app.mail.from:noreply@naeil.com}")
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
            Long userId = findUserIdByName(record.getEmployeeName());
            PayrollRecord toSave = PayrollRecord.builder()
                .companyId(DEFAULT_COMPANY_ID)
                .payYearMonth(payYearMonth)
                .employeeName(record.getEmployeeName())
                .userId(userId)
                .baseSalary(record.getBaseSalary())
                .weeklyHolidayWeeks(record.getWeeklyHolidayWeeks())
                .weeklyHolidayAuto(record.getWeeklyHolidayAuto())
                .weeklyHolidayAllowance(record.getWeeklyHolidayAllowance())
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
            for (int s = 0; s < workbook.getNumberOfSheets(); s++) {
                Sheet sheet = workbook.getSheetAt(s);
                PayrollRecord record = parsePayslipSheet(sheet, payYearMonth);
                if (record != null) result.add(record);
            }
        }
        return result;
    }

    private PayrollRecord parsePayslipSheet(Sheet sheet, String payYearMonth) {
        Map<String, BigDecimal> moneyMap = new LinkedHashMap<>();
        String employeeName = null;

        for (int r = 0; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;

            for (Cell cell : row) {
                String raw = getCellString(cell);
                if (raw == null || raw.isBlank()) continue;

                String normalized = raw.replaceAll("\\s+", "");

                if (employeeName == null && normalized.contains("성명")) {
                    if (normalized.contains(":")) {
                        String afterColon = normalized.substring(normalized.indexOf(":") + 1).trim();
                        if (!afterColon.isBlank()) {
                            employeeName = afterColon;
                            continue;
                        }
                    }
                    employeeName = findNextNonEmptyString(row, cell.getColumnIndex() + 1);
                    continue;
                }

                String key = normalized;
                BigDecimal amount = findNextNumericValue(row, cell.getColumnIndex() + 1, 20);
                if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
                    moneyMap.putIfAbsent(key, amount);
                }
            }
        }

        if (employeeName == null || employeeName.isBlank()) {
            String sheetName = sheet.getSheetName();
            if (sheetName != null && !sheetName.isBlank()) {
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
            .netPay(get(moneyMap, "실수령액", "차인지급액", "실지급액"))
            .build();
    }

    private String findNextNonEmptyString(Row row, int startCol) {
        for (int c = startCol; c < startCol + 10; c++) {
            Cell cell = row.getCell(c);
            String val = getCellString(cell);
            if (val != null && !val.isBlank()) {
                String norm = val.replaceAll("\\s+", "");
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

    @Transactional
    public PayrollDto.RecordResponse calculateAndSave(Map<String, Object> payload) {
        String payYearMonth = text(payload.get("payYearMonth"), java.time.YearMonth.now().toString());
        String employeeName = text(payload.get("employeeName"), "").trim();
        if (employeeName.isBlank()) {
            throw new IllegalArgumentException("직원명을 입력하세요.");
        }

        String salaryType = text(payload.get("salaryType"), "ANNUAL").toUpperCase(Locale.ROOT);
        BigDecimal annualSalary = money(payload.get("annualSalary"));
        BigDecimal hourlyWage = money(payload.get("hourlyWage"));
        BigDecimal workDays = decimal(payload.get("workDays"));
        BigDecimal workHours = decimal(payload.get("workHours"));
        BigDecimal hoursPerDay = decimal(payload.get("hoursPerDay"));
        BigDecimal weeklyHolidayWeeks = decimal(payload.get("weeklyHolidayWeeks"));
        boolean weeklyHolidayAuto = booleanValue(payload.get("weeklyHolidayAuto"));
        BigDecimal requestedWeeklyHolidayAllowance = money(payload.get("weeklyHolidayAllowance"));
        BigDecimal mealAllowance = money(payload.get("mealAllowance"));
        BigDecimal transportAllowance = money(payload.get("transportAllowance"));
        BigDecimal otherAllowance = money(payload.get("otherAllowance"));

        BigDecimal baseSalary = "HOURLY".equals(salaryType)
            ? hourlyWage.multiply(workHours)
            : annualSalary.divide(BigDecimal.valueOf(12), 0, RoundingMode.HALF_UP);

        if (hoursPerDay.compareTo(BigDecimal.ZERO) == 0 && workDays.compareTo(BigDecimal.ZERO) > 0) {
            hoursPerDay = workHours.divide(workDays, 4, RoundingMode.HALF_UP);
        }
        BigDecimal weeklyHolidayAllowance = "HOURLY".equals(salaryType)
            ? (weeklyHolidayAuto
                ? won(hourlyWage.multiply(hoursPerDay).multiply(weeklyHolidayWeeks))
                : requestedWeeklyHolidayAllowance)
            : BigDecimal.ZERO;

        BigDecimal totalPayment = baseSalary
            .add(weeklyHolidayAllowance)
            .add(mealAllowance)
            .add(transportAllowance)
            .add(otherAllowance);
        InsuranceRates insuranceRates = insuranceRatesFor(payYearMonth);
        BigDecimal nationalPensionRate = rate(payload.get("nationalPensionRate"), insuranceRates.nationalPension());
        BigDecimal healthInsuranceRate = rate(payload.get("healthInsuranceRate"), insuranceRates.healthInsurance());
        BigDecimal longTermCareRate = rate(payload.get("longTermCareRate"), insuranceRates.longTermCare());
        BigDecimal employmentInsuranceRate = rate(payload.get("employmentInsuranceRate"), insuranceRates.employmentInsurance());

        BigDecimal nationalPension = won(totalPayment.multiply(nationalPensionRate));
        BigDecimal healthInsurance = won(totalPayment.multiply(healthInsuranceRate));
        BigDecimal longTermCare = won(healthInsurance.multiply(longTermCareRate));
        BigDecimal employmentInsurance = won(totalPayment.multiply(employmentInsuranceRate));
        BigDecimal incomeTax = money(payload.get("incomeTax"));
        BigDecimal localIncomeTax = money(payload.get("localIncomeTax"));
        BigDecimal totalDeduction = nationalPension
            .add(healthInsurance)
            .add(longTermCare)
            .add(employmentInsurance)
            .add(incomeTax)
            .add(localIncomeTax);
        BigDecimal netPay = totalPayment.subtract(totalDeduction);
        Long userId = payload.get("userId") == null || payload.get("userId").toString().isBlank()
            ? findUserIdByName(employeeName)
            : Long.valueOf(payload.get("userId").toString());

        Long id = upsertCalculatedRecord(
            payYearMonth, employeeName, userId, salaryType,
            annualSalary, hourlyWage, workDays, workHours, baseSalary,
            weeklyHolidayWeeks, weeklyHolidayAuto, weeklyHolidayAllowance,
            mealAllowance, transportAllowance, otherAllowance,
            totalPayment, nationalPension, healthInsurance, longTermCare,
            employmentInsurance, incomeTax, localIncomeTax, totalDeduction, netPay
        );

        return payrollRecordRepository.findById(id)
            .map(PayrollDto.RecordResponse::from)
            .orElseThrow();
    }

    private Long upsertCalculatedRecord(
        String payYearMonth, String employeeName, Long userId, String salaryType,
        BigDecimal annualSalary, BigDecimal hourlyWage, BigDecimal workDays, BigDecimal workHours,
        BigDecimal baseSalary, BigDecimal weeklyHolidayWeeks, boolean weeklyHolidayAuto,
        BigDecimal weeklyHolidayAllowance, BigDecimal mealAllowance, BigDecimal transportAllowance,
        BigDecimal otherAllowance, BigDecimal totalPayment, BigDecimal nationalPension,
        BigDecimal healthInsurance, BigDecimal longTermCare, BigDecimal employmentInsurance,
        BigDecimal incomeTax, BigDecimal localIncomeTax, BigDecimal totalDeduction, BigDecimal netPay
    ) {
        return jdbcTemplate.queryForObject("""
            INSERT INTO payroll_record (
                company_id, pay_year_month, employee_name, user_id, salary_type,
                annual_salary, hourly_wage, work_days, work_hours,
                base_salary, weekly_holiday_weeks, weekly_holiday_auto, weekly_holiday_allowance,
                meal_allowance, transport_allowance, other_allowance,
                total_payment, deduction_national_pension, deduction_health_insurance,
                deduction_long_term_care, deduction_employment_insurance,
                deduction_income_tax, deduction_local_income_tax, total_deduction, net_pay
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (company_id, pay_year_month, employee_name)
            DO UPDATE SET
                user_id = EXCLUDED.user_id,
                salary_type = EXCLUDED.salary_type,
                annual_salary = EXCLUDED.annual_salary,
                hourly_wage = EXCLUDED.hourly_wage,
                work_days = EXCLUDED.work_days,
                work_hours = EXCLUDED.work_hours,
                base_salary = EXCLUDED.base_salary,
                weekly_holiday_weeks = EXCLUDED.weekly_holiday_weeks,
                weekly_holiday_auto = EXCLUDED.weekly_holiday_auto,
                weekly_holiday_allowance = EXCLUDED.weekly_holiday_allowance,
                meal_allowance = EXCLUDED.meal_allowance,
                transport_allowance = EXCLUDED.transport_allowance,
                other_allowance = EXCLUDED.other_allowance,
                total_payment = EXCLUDED.total_payment,
                deduction_national_pension = EXCLUDED.deduction_national_pension,
                deduction_health_insurance = EXCLUDED.deduction_health_insurance,
                deduction_long_term_care = EXCLUDED.deduction_long_term_care,
                deduction_employment_insurance = EXCLUDED.deduction_employment_insurance,
                deduction_income_tax = EXCLUDED.deduction_income_tax,
                deduction_local_income_tax = EXCLUDED.deduction_local_income_tax,
                total_deduction = EXCLUDED.total_deduction,
                net_pay = EXCLUDED.net_pay,
                updated_at = NOW()
            RETURNING id
            """,
            Long.class,
            DEFAULT_COMPANY_ID, payYearMonth, employeeName, userId, salaryType,
            annualSalary, hourlyWage, workDays, workHours, baseSalary,
            weeklyHolidayWeeks, weeklyHolidayAuto, weeklyHolidayAllowance,
            mealAllowance, transportAllowance, otherAllowance,
            totalPayment, nationalPension, healthInsurance, longTermCare,
            employmentInsurance, incomeTax, localIncomeTax, totalDeduction, netPay
        );
    }

    // ──────────────────────────────────────────────
    // 출퇴근 기록 기반 근무 데이터 자동 조회 (시급제 전용)
    // ──────────────────────────────────────────────

    /**
     * 출퇴근 기록(staff_attendance_record)에서 해당 월/직원의 근무 데이터를 집계
     * - 출근일: clock_out_at IS NOT NULL 인 날 수 (퇴근 완료된 날만)
     * - 총 근무시간: SUM(EXTRACT(EPOCH FROM (clock_out_at - clock_in_at)) / 3600)
     * - 주휴수당 발생 주수: 주 15시간 이상 근무한 주 수
     */
    public PayrollDto.AttendanceSummary getAttendanceSummary(String payYearMonth, Long userId) {
        // userId로 username 조회
        String username;
        try {
            username = jdbcTemplate.queryForObject(
                "SELECT username FROM dashboard_user WHERE id = ? AND company_id = ?",
                String.class, userId, DEFAULT_COMPANY_ID);
        } catch (Exception e) {
            return new PayrollDto.AttendanceSummary(0, 0.0, 0.0, 0.0, "직원 정보를 찾을 수 없습니다.");
        }
        if (username == null) {
            return new PayrollDto.AttendanceSummary(0, 0.0, 0.0, 0.0, "직원 정보를 찾을 수 없습니다.");
        }

        // 해당 월의 출퇴근 완료 기록 조회 (퇴근 기록 있는 날만)
        java.time.YearMonth ym;
        try {
            ym = java.time.YearMonth.parse(payYearMonth);
        } catch (Exception e) {
            ym = java.time.YearMonth.now();
        }
        java.time.LocalDate monthStart = ym.atDay(1);
        java.time.LocalDate monthEnd = ym.atEndOfMonth();

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT
                work_date,
                clock_in_at,
                clock_out_at,
                EXTRACT(EPOCH FROM (clock_out_at - clock_in_at)) / 3600.0 AS work_hours_day,
                DATE_PART('week', work_date) AS week_number
            FROM staff_attendance_record
            WHERE company_id = ?
              AND LOWER(username) = LOWER(?)
              AND work_date BETWEEN ? AND ?
              AND clock_in_at IS NOT NULL
              AND clock_out_at IS NOT NULL
            ORDER BY work_date
            """, DEFAULT_COMPANY_ID, username, monthStart, monthEnd);

        if (rows.isEmpty()) {
            return new PayrollDto.AttendanceSummary(0, 0.0, 0.0, 0.0,
                "출퇴근 기록이 없습니다. 출퇴근 기록 메뉴에서 확인해 주세요.");
        }

        int workDays = rows.size();
        double totalWorkHours = rows.stream()
            .mapToDouble(r -> {
                Object h = r.get("work_hours_day");
                if (h == null) return 0.0;
                return ((Number) h).doubleValue();
            })
            .filter(h -> h > 0)
            .sum();

        // 소수점 2자리 반올림
        totalWorkHours = Math.round(totalWorkHours * 100.0) / 100.0;
        double avgHoursPerDay = workDays > 0 ? Math.round((totalWorkHours / workDays) * 100.0) / 100.0 : 0.0;

        // 주휴수당 발생 주수: 주 15시간 이상 근무한 주 수
        Map<Double, Double> weeklyHours = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Object weekObj = row.get("week_number");
            Object hoursObj = row.get("work_hours_day");
            if (weekObj == null || hoursObj == null) continue;
            double week = ((Number) weekObj).doubleValue();
            double hours = ((Number) hoursObj).doubleValue();
            weeklyHours.merge(week, hours, Double::sum);
        }
        long qualifyingWeeks = weeklyHours.values().stream()
            .filter(h -> h >= 15.0)
            .count();

        String message = String.format(
            "%d일 출근, 총 %.1f시간 근무, 주휴 발생 %d주 (주 15시간 이상)",
            workDays, totalWorkHours, qualifyingWeeks
        );

        return new PayrollDto.AttendanceSummary(
            workDays,
            totalWorkHours,
            avgHoursPerDay,
            (double) qualifyingWeeks,
            message
        );
    }

    // ──────────────────────────────────────────────
    // 이메일 발송
    // ──────────────────────────────────────────────

    @Transactional
    public PayrollDto.SendResult sendPayslips(String payYearMonth) {
        if (mailSender == null) {
            log.warn("메일 서버 설정이 없습니다. 급여명세서 이메일 발송을 건너뜁니다.");
            return new PayrollDto.SendResult(0, 0, List.of("메일 서버 미설정 - 관리자에게 문의하세요."));
        }

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
            <tr><td>주휴수당</td><td style="text-align:right;">%,d 원</td></tr>
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
                r.getWeeklyHolidayAllowance().longValue(),
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
        String yearMonth = java.time.YearMonth.now().toString();
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

    private static String text(Object value, String fallback) {
        return value == null || value.toString().isBlank() ? fallback : value.toString();
    }

    private static BigDecimal money(Object value) {
        return won(decimal(value));
    }

    private static BigDecimal decimal(Object value) {
        if (value == null || value.toString().isBlank()) {
            return BigDecimal.ZERO;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        try {
            return new BigDecimal(value.toString().replace(",", ""));
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }

    private static BigDecimal rate(Object value, String fallback) {
        BigDecimal parsed = value == null || value.toString().isBlank()
            ? new BigDecimal(fallback)
            : decimal(value);
        if (parsed.compareTo(BigDecimal.valueOf(0.1)) >= 0) {
            return parsed.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
        }
        return parsed;
    }

    private static InsuranceRates insuranceRatesFor(String payYearMonth) {
        int year = java.time.YearMonth.now().getYear();
        try {
            if (payYearMonth != null && payYearMonth.length() >= 4) {
                year = Integer.parseInt(payYearMonth.substring(0, 4));
            }
        } catch (Exception ignored) {}
        if (INSURANCE_RATES_BY_YEAR.containsKey(year)) {
            return INSURANCE_RATES_BY_YEAR.get(year);
        }
        int latestYear = INSURANCE_RATES_BY_YEAR.keySet().stream().max(Integer::compareTo).orElse(2026);
        return INSURANCE_RATES_BY_YEAR.get(latestYear);
    }

    private record InsuranceRates(
        String nationalPension,
        String healthInsurance,
        String longTermCare,
        String employmentInsurance
    ) {}

    private static boolean booleanValue(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        String t = value.toString().trim();
        return "true".equalsIgnoreCase(t) || "1".equals(t) || "Y".equalsIgnoreCase(t);
    }

    private static BigDecimal won(BigDecimal value) {
        return value.setScale(0, RoundingMode.HALF_UP);
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
