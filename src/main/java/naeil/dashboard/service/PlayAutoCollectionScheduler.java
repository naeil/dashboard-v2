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

    // 매 정시(0분)마다 실행 — 1시간 간격으로 최신 매출/재고 동기화
    @Scheduled(cron = "0 0 * * * *")
    public void runScheduledCollection() {
        LocalDateTime now = LocalDateTime.now();
        log.info("[Scheduler] PlayAuto 자동 수집 시작: {}", now);

        for (IntegrationSetting setting : integrationSettingService.getActivePlayAutoSettings()) {
            try {
                boolean inventoryDue = isInventoryDue(setting, now);
                boolean orderDue = isOrderDue(setting, now);

                if (!inventoryDue && !orderDue) {
                    log.debug("[Scheduler] companyId={} skip (not due)", setting.getCompanyId());
                    continue;
                }

                Long companyId = setting.getCompanyId();
                if (inventoryDue) {
                    log.info("[Scheduler] companyId={} 재고 수집 실행", companyId);
                    playAutoCollectionService.runInventoryCollection(companyId, true);
                }
                if (orderDue) {
                    log.info("[Scheduler] companyId={} 주문/매출 수집 실행", companyId);
                    playAutoCollectionService.runOrderCollection(companyId, true);
                }
            } catch (Exception e) {
                log.error("[Scheduler] companyId={} 수집 실패", setting.getCompanyId(), e);
            }
        }
        log.info("[Scheduler] PlayAuto 자동 수집 완료: {}", LocalDateTime.now());
    }

    /**
     * 주문 수집 실행 여부 판단
     * - autoCollectEnabled=true 필수
     * - scheduleUnit/Value 미설정 시 1시간 기본값 적용
     * - lastOrderCollectedAt 기준으로 다음 실행 시각 초과 여부 확인
     */
    private boolean isOrderDue(IntegrationSetting setting, LocalDateTime now) {
        if (!Boolean.TRUE.equals(setting.getAutoCollectEnabled())) {
            return false;
        }

        LocalDateTime lastCollectedAt = setting.getLastOrderCollectedAt();
        if (lastCollectedAt == null) {
            return true;
        }

        // scheduleUnit/Value 미설정이면 1시간 기본값
        if (setting.getScheduleUnit() == null || setting.getScheduleValue() == null || setting.getScheduleValue() <= 0) {
            return !lastCollectedAt.plusHours(1).isAfter(now);
        }

        LocalDateTime nextRunAt = switch (setting.getScheduleUnit()) {
            case HOUR  -> lastCollectedAt.plusHours(setting.getScheduleValue());
            case DAY   -> lastCollectedAt.plusDays(setting.getScheduleValue());
            case WEEK  -> lastCollectedAt.plusWeeks(setting.getScheduleValue());
            case MONTH -> lastCollectedAt.plusMonths(setting.getScheduleValue());
        };

        return !nextRunAt.isAfter(now);
    }

    /**
     * 재고 수집 실행 여부 판단 — 항상 24시간 간격
     */
    private boolean isInventoryDue(IntegrationSetting setting, LocalDateTime now) {
        LocalDateTime lastCollectedAt = setting.getLastInventoryCollectedAt();
        if (lastCollectedAt == null) {
            return true;
        }
        return !lastCollectedAt.plusHours(24).isAfter(now);
    }
}
