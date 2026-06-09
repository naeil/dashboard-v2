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
}
