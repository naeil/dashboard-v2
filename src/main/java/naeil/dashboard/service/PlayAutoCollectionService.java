package naeil.dashboard.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
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
    private static final int ORDER_COLLECTION_CHUNK_DAYS = 7;

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

            runChunkedOrderSync(
                    companyId,
                    credentials.accessToken(),
                    credentials.apiKey(),
                    window.startDate(),
                    window.endDate(),
                    triggerLabel
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

    private void runChunkedOrderSync(
            Long companyId,
            String token,
            String apiKey,
            LocalDate startDate,
            LocalDate endDate,
            String triggerLabel
    ) {
        List<CollectionChunk> chunks = splitIntoChunks(startDate, endDate, ORDER_COLLECTION_CHUNK_DAYS);
        log.info(
                "Starting {} PlayAuto order chunk processing for company {}. totalChunks={} [{} ~ {}]",
                triggerLabel,
                companyId,
                chunks.size(),
                startDate,
                endDate
        );

        for (int index = 0; index < chunks.size(); index++) {
            CollectionChunk chunk = chunks.get(index);
            int chunkNumber = index + 1;

            log.info(
                    "Starting {} PlayAuto order chunk {}/{} for company {} [{} ~ {}]",
                    triggerLabel,
                    chunkNumber,
                    chunks.size(),
                    companyId,
                    chunk.startDate(),
                    chunk.endDate()
            );

            playAutoSyncService.syncOrders(
                    companyId,
                    token,
                    apiKey,
                    chunk.startDate().format(DATE_FORMATTER),
                    chunk.endDate().format(DATE_FORMATTER)
            );

            log.info(
                    "Completed {} PlayAuto order chunk {}/{} for company {} [{} ~ {}]",
                    triggerLabel,
                    chunkNumber,
                    chunks.size(),
                    companyId,
                    chunk.startDate(),
                    chunk.endDate()
            );
        }
    }

    private List<CollectionChunk> splitIntoChunks(LocalDate startDate, LocalDate endDate, int chunkDays) {
        List<CollectionChunk> chunks = new ArrayList<>();
        for (LocalDate current = startDate; !current.isAfter(endDate); current = current.plusDays(chunkDays)) {
            LocalDate chunkEnd = current.plusDays(chunkDays - 1L);
            if (chunkEnd.isAfter(endDate)) {
                chunkEnd = endDate;
            }
            chunks.add(new CollectionChunk(current, chunkEnd));
        }
        return chunks;
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

    private record CollectionChunk(LocalDate startDate, LocalDate endDate) {
    }
}
