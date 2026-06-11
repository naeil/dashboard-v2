package naeil.dashboard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public class PartnerPaymentLedgerDTO {
        private Long id;
        private Long companyId;
        private String partnerName;
        private String direction; // RECEIVABLE or PAYABLE
    private BigDecimal amount;
        private LocalDate issueDate;
        private LocalDate dueDate;
        private Boolean taxInvoiceIssued;
        private Boolean paymentConfirmed;
        private String description;
        private String status; // PENDING, DONE, CANCELLED
    private LocalDateTime createdAt;
  }
