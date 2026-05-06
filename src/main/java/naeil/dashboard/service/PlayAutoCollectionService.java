package naeil.dashboard.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.enums.CollectionJobType;
import naeil.dashboard.enums.IntegrationType;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlayAutoCollectionService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_DATE;

    private final IntegrationSettingService integrationSettingService;
    private final PlayAutoSyncService playAutoSyncService;

    public void runOrderCollection(Long companyId, boolean automatic) {
        LocalDateTime startedAt = LocalDateTime.now();
        IntegrationSettingService.CollectionWindow window =
                integrationSettingService.getPlayAutoCollectionWindow(companyId);
        String triggerLabel = automatic ? "자동" : "수동";
        String historyMessage = String.format("주문 %s 수집 [%s ~ %s]", triggerLabel, window.startDate(), window.endDate());
        Long historyId = integrationSettingService.recordCollectionExecutionStarted(
                companyId,
                IntegrationType.PLAYAUTO,
                CollectionJobType.ORDER,
                startedAt,
                historyMessage
        );

        try {
            IntegrationSettingService.PlayAutoCredentials credentials =
                    integrationSettingService.getValidPlayAutoCredentials(companyId);

            log.info(
                    "Starting {} PlayAuto order collection for company {} [{} ~ {}]",
                    triggerLabel,
                    companyId,
                    window.startDate(),
                    window.endDate()
            );

            playAutoSyncService.syncProducts(
                    companyId,
                    credentials.accessToken(),
                    credentials.apiKey(),
                    window.startDate().format(DATE_FORMATTER),
                    window.endDate().format(DATE_FORMATTER)
            );
            playAutoSyncService.syncOrders(
                    companyId,
                    credentials.accessToken(),
                    credentials.apiKey(),
                    window.startDate().format(DATE_FORMATTER),
                    window.endDate().format(DATE_FORMATTER)
            );
            playAutoSyncService.remapOrdersToResolvedProducts(companyId);
            playAutoSyncService.rebuildDailySalesStats(companyId);

            LocalDateTime finishedAt = LocalDateTime.now();
            integrationSettingService.markOrderCollectionCompleted(companyId, finishedAt);
            integrationSettingService.markCollectionExecutionSucceeded(historyId, finishedAt, historyMessage);
            log.info("Completed {} PlayAuto order collection for company {}", triggerLabel, companyId);
        } catch (Exception e) {
            integrationSettingService.markCollectionExecutionFailed(
                    historyId,
                    LocalDateTime.now(),
                    buildFailureMessage(historyMessage, e)
            );
            throw e;
        }
    }

    public void runInventoryCollection(Long companyId, boolean automatic) {
        LocalDateTime startedAt = LocalDateTime.now();
        LocalDate today = startedAt.toLocalDate();
        LocalDate startDate = today.minusDays(1);
        LocalDate endDate = today;
        String triggerLabel = automatic ? "자동" : "수동";
        String historyMessage = String.format("재고/출고량 %s 수집 [%s ~ %s]", triggerLabel, startDate, endDate);
        Long historyId = integrationSettingService.recordCollectionExecutionStarted(
                companyId,
                IntegrationType.PLAYAUTO,
                CollectionJobType.INVENTORY,
                startedAt,
                historyMessage
        );

        try {
            IntegrationSettingService.PlayAutoCredentials credentials =
                    integrationSettingService.getValidPlayAutoCredentials(companyId);

            log.info(
                    "Starting {} PlayAuto inventory collection for company {} [{} ~ {}]",
                    triggerLabel,
                    companyId,
                    startDate,
                    endDate
            );

            playAutoSyncService.syncShops(companyId, credentials.accessToken(), credentials.apiKey());
            playAutoSyncService.syncProducts(
                    companyId,
                    credentials.accessToken(),
                    credentials.apiKey(),
                    startDate.format(DATE_FORMATTER),
                    endDate.format(DATE_FORMATTER)
            );
            syncMissingProductOutbound(
                    companyId,
                    credentials.accessToken(),
                    credentials.apiKey(),
                    today
            );

            LocalDateTime finishedAt = LocalDateTime.now();
            integrationSettingService.markInventoryCollectionCompleted(companyId, finishedAt);
            integrationSettingService.markCollectionExecutionSucceeded(historyId, finishedAt, historyMessage);
            log.info("Completed {} PlayAuto inventory collection for company {}", triggerLabel, companyId);
        } catch (Exception e) {
            integrationSettingService.markCollectionExecutionFailed(
                    historyId,
                    LocalDateTime.now(),
                    buildFailureMessage(historyMessage, e)
            );
            throw e;
        }
    }

    private void syncMissingProductOutbound(
            Long companyId,
            String token,
            String apiKey,
            LocalDate today
    ) {
        LocalDate lastCollectedDate = playAutoSyncService.getLastProductOutboundDate(companyId);
        LocalDate startDate = lastCollectedDate != null ? lastCollectedDate.plusDays(1) : today.minusDays(1);
        LocalDate endDate = today.minusDays(1);

        if (startDate.isAfter(endDate)) {
            return;
        }

        for (LocalDate current = startDate; !current.isAfter(endDate); current = current.plusDays(1)) {
            playAutoSyncService.syncProductOutbound(companyId, token, apiKey, current);
        }
    }

    private String buildFailureMessage(String baseMessage, Exception e) {
        String detail = e.getMessage();
        if (detail == null || detail.isBlank()) {
            return baseMessage + " 실패";
        }
        return baseMessage + " 실패: " + detail;
    }
}
