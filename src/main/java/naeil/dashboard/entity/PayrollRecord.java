package naeil.dashboard.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payroll_record")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class PayrollRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "pay_year_month", nullable = false, length = 7)
    private String payYearMonth; // e.g. "2026-05"

    @Column(name = "employee_name", nullable = false, length = 80)
    private String employeeName;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "base_salary", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal baseSalary = BigDecimal.ZERO;

    @Column(name = "meal_allowance", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal mealAllowance = BigDecimal.ZERO;

    @Column(name = "transport_allowance", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal transportAllowance = BigDecimal.ZERO;

    @Column(name = "other_allowance", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal otherAllowance = BigDecimal.ZERO;

    @Column(name = "total_payment", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalPayment = BigDecimal.ZERO;

    @Column(name = "deduction_national_pension", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal deductionNationalPension = BigDecimal.ZERO;

    @Column(name = "deduction_health_insurance", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal deductionHealthInsurance = BigDecimal.ZERO;

    @Column(name = "deduction_long_term_care", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal deductionLongTermCare = BigDecimal.ZERO;

    @Column(name = "deduction_employment_insurance", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal deductionEmploymentInsurance = BigDecimal.ZERO;

    @Column(name = "deduction_income_tax", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal deductionIncomeTax = BigDecimal.ZERO;

    @Column(name = "deduction_local_income_tax", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal deductionLocalIncomeTax = BigDecimal.ZERO;

    @Column(name = "total_deduction", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalDeduction = BigDecimal.ZERO;

    @Column(name = "net_pay", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal netPay = BigDecimal.ZERO;

    @Column(name = "email_sent_at")
    private LocalDateTime emailSentAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public void markEmailSent() {
        this.emailSentAt = LocalDateTime.now();
    }
}
