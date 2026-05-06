package naeil.dashboard.service;

import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.entity.IntegrationSetting;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlayAutoCollectionScheduler {

    private final IntegrationSettingService integrationSettingService;
    private final PlayAutoCollectionService playAutoCollectionService;

    @Scheduled(fixedDelayString = "${app.playauto.scheduler.fixed-delay-ms:600000}")
    public void runScheduledCollection() {
        LocalDateTime now = LocalDateTime.now();

        for (IntegrationSetting setting : integrationSettingService.getActivePlayAutoSettings()) {
            try {
                boolean inventoryDue = isInventoryDue(setting, now);
                boolean orderDue = isOrderDue(setting, now);
                if (!inventoryDue && !orderDue) {
                    continue;
                }

                Long companyId = setting.getCompanyId();
                if (inventoryDue) {
                    playAutoCollectionService.runInventoryCollection(companyId, true);
                }

                if (orderDue) {
                    playAutoCollectionService.runOrderCollection(companyId, true);
                }
            } catch (Exception e) {
                log.error("Scheduled PlayAuto collection failed for company {}", setting.getCompanyId(), e);
            }
        }
    }

    private boolean isOrderDue(IntegrationSetting setting, LocalDateTime now) {
        if (!Boolean.TRUE.equals(setting.getAutoCollectEnabled())) {
            return false;
        }

        if (setting.getScheduleUnit() == null || setting.getScheduleValue() == null || setting.getScheduleValue() <= 0) {
            return false;
        }

        LocalDateTime lastCollectedAt = setting.getLastOrderCollectedAt();
        if (lastCollectedAt == null) {
            return true;
        }

        LocalDateTime nextRunAt = switch (setting.getScheduleUnit()) {
            case DAY -> lastCollectedAt.plusDays(setting.getScheduleValue());
            case WEEK -> lastCollectedAt.plusWeeks(setting.getScheduleValue());
            case MONTH -> lastCollectedAt.plusMonths(setting.getScheduleValue());
        };

        return !nextRunAt.isAfter(now);
    }

    private boolean isInventoryDue(IntegrationSetting setting, LocalDateTime now) {
        LocalDateTime lastCollectedAt = setting.getLastInventoryCollectedAt();
        if (lastCollectedAt == null) {
            return true;
        }

        return !lastCollectedAt.plusHours(24).isAfter(now);
    }
}
