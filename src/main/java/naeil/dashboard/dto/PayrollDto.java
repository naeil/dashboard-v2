package naeil.dashboard.dto;

import naeil.dashboard.entity.PayrollRecord;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class PayrollDto {

    public record RecordResponse(
        Long id,
        String payYearMonth,
        String employeeName,
        Long userId,
        String salaryType,
        BigDecimal annualSalary,
        BigDecimal hourlyWage,
        BigDecimal workDays,
        BigDecimal workHours,
        BigDecimal baseSalary,
        BigDecimal weeklyHolidayWeeks,
        Boolean weeklyHolidayAuto,
        BigDecimal weeklyHolidayAllowance,
        BigDecimal mealAllowance,
        BigDecimal transportAllowance,
        BigDecimal otherAllowance,
        BigDecimal totalPayment,
        BigDecimal deductionNationalPension,
        BigDecimal deductionHealthInsurance,
        BigDecimal deductionLongTermCare,
        BigDecimal deductionEmploymentInsurance,
        BigDecimal deductionIncomeTax,
        BigDecimal deductionLocalIncomeTax,
        BigDecimal totalDeduction,
        BigDecimal netPay,
        LocalDateTime emailSentAt
    ) {
        public static RecordResponse from(PayrollRecord r) {
            return new RecordResponse(
                r.getId(),
                r.getPayYearMonth(),
                r.getEmployeeName(),
                r.getUserId(),
                r.getSalaryType(),
                r.getAnnualSalary(),
                r.getHourlyWage(),
                r.getWorkDays(),
                r.getWorkHours(),
                r.getBaseSalary(),
                r.getWeeklyHolidayWeeks(),
                r.getWeeklyHolidayAuto(),
                r.getWeeklyHolidayAllowance(),
                r.getMealAllowance(),
                r.getTransportAllowance(),
                r.getOtherAllowance(),
                r.getTotalPayment(),
                r.getDeductionNationalPension(),
                r.getDeductionHealthInsurance(),
                r.getDeductionLongTermCare(),
                r.getDeductionEmploymentInsurance(),
                r.getDeductionIncomeTax(),
                r.getDeductionLocalIncomeTax(),
                r.getTotalDeduction(),
                r.getNetPay(),
                r.getEmailSentAt()
            );
        }
    }

    public record UploadResult(
        int total,
        int imported,
        int skipped,
        List<String> skippedNames
    ) {}

    public record SendResult(
        int sent,
        int failed,
        List<String> failedNames
    ) {}

    public record UserEmailUpdateRequest(
        Long userId,
        String email
    ) {}

    /**
     * 출퇴근 기록 기반 시급제 근무 데이터 요약
     * - workDays: 해당 월 실제 출근일수 (퇴근 기록이 있는 날)
     * - totalWorkHours: 해당 월 총 근무시간 (퇴근시각 - 출근시각 합산)
     * - avgHoursPerDay: 1일 평균 근무시간
     * - weeklyHolidayWeeks: 주휴수당 발생 주수 (주 15시간 이상 개근한 주 수)
     */
    public record AttendanceSummary(
        int workDays,
        double totalWorkHours,
        double avgHoursPerDay,
        double weeklyHolidayWeeks,
        String message
    ) {}
}
