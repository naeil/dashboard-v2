package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewSchedulerService {

    private final AiReviewService reviewService;

    @Scheduled(fixedDelay = 600000) // 10분
    public void syncAndAnalyzeReviews() {
        try {
            log.info("[ReviewScheduler] 리뷰 자동 수집 시작");
        } catch (Exception e) {
            log.error("[ReviewScheduler] 리뷰 수집 실패", e);
        }
    }

    @Scheduled(cron = "0 0 8 * * *") // 매일 오전 8시
    public void generateDailyVocReport() {
        try {
            log.info("[ReviewScheduler] VOC 보고서 생성 시작");
        } catch (Exception e) {
            log.error("[ReviewScheduler] VOC 보고서 생성 실패", e);
        }
    }
}
