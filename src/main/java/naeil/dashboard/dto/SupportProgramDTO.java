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
  public class SupportProgramDTO {
        private Long id;
        private Long companyId;
        private String programName;
        private String organization;
        private LocalDate appliedDate;
        private BigDecimal amount;
        private String status; // APPLYING, REVIEWING, SELECTED, REJECTED, DONE
    private String managerName;
        private String memo;
        private LocalDateTime createdAt;
  }
