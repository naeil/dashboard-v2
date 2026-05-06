package naeil.dashboard.dto;

import java.time.LocalDateTime;
import naeil.dashboard.enums.CollectionExecutionStatus;
import naeil.dashboard.enums.CollectionJobType;
import naeil.dashboard.enums.IntegrationType;

public record CollectionExecutionHistoryDto(
        Long id,
        IntegrationType integrationType,
        CollectionJobType jobType,
        CollectionExecutionStatus status,
        String message,
        LocalDateTime startedAt,
        LocalDateTime finishedAt
) {}
