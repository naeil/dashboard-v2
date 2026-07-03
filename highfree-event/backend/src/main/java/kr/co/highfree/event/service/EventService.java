package kr.co.highfree.event.service;

import kr.co.highfree.event.config.EventProps;
import kr.co.highfree.event.domain.*;
import kr.co.highfree.event.dto.Dtos.*;
import kr.co.highfree.event.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
public class EventService {

    private static final Logger log = LoggerFactory.getLogger(EventService.class);

    private final EventProps eventProps;
    private final QrCodeRepository qrCodeRepo;
    private final EventSessionRepository sessionRepo;
    private final SpinResultRepository spinResultRepo;
    private final CustomerRepository customerRepo;
    private final PointTransactionRepository ptRepo;
    private final SecureRandom secureRandom = new SecureRandom();

    public EventService(EventProps eventProps, QrCodeRepository qrCodeRepo,
                        EventSessionRepository sessionRepo, SpinResultRepository spinResultRepo,
                        CustomerRepository customerRepo, PointTransactionRepository ptRepo) {
        this.eventProps = eventProps;
        this.qrCodeRepo = qrCodeRepo;
        this.sessionRepo = sessionRepo;
        this.spinResultRepo = spinResultRepo;
        this.customerRepo = customerRepo;
        this.ptRepo = ptRepo;
    }

    @Transactional
    public SessionResponse createSession(SessionRequest req, String ip, String ua) {
        QrCode qrCode = qrCodeRepo.findByQrId(req.getQrId()).orElseGet(() -> {
            QrCode newQr = QrCode.builder()
                .qrId(req.getQrId())
                .country(req.getCountry())
                .channel(req.getChannel())
                .product(req.getProduct())
                .flavor(req.getFlavor())
                .campaign(req.getCampaign())
                .build();
            return qrCodeRepo.save(newQr);
        });

        EventSession session = EventSession.builder()
            .qrCode(qrCode)
            .ipAddress(ip)
            .userAgent(ua)
            .referrer(req.getReferrer())
            .country(req.getCountry() != null ? req.getCountry() : qrCode.getCountry())
            .channel(req.getChannel() != null ? req.getChannel() : qrCode.getChannel())
            .product(req.getProduct() != null ? req.getProduct() : qrCode.getProduct())
            .flavor(req.getFlavor() != null ? req.getFlavor() : qrCode.getFlavor())
            .campaign(req.getCampaign() != null ? req.getCampaign() : qrCode.getCampaign())
            .build();
        session = sessionRepo.save(session);

        boolean alreadySpun = spinResultRepo.existsBySessionId(session.getSessionId());
        return SessionResponse.builder()
            .sessionId(session.getSessionId())
            .alreadySpun(alreadySpun)
            .build();
    }

    @Transactional
    public SpinResponse spin(SpinRequest req) {
        sessionRepo.findBySessionId(req.getSessionId())
            .orElseThrow(() -> new IllegalArgumentException("Invalid session"));

        if (spinResultRepo.existsBySessionId(req.getSessionId())) {
            throw new IllegalStateException("Already spun");
        }

        EventProps.RewardConfig reward = pickReward();
        SpinResult result = SpinResult.builder()
            .sessionId(req.getSessionId())
            .rewardKey(reward.getKey())
            .rewardLabel(reward.getLabel())
            .rewardPoints(reward.getPoints())
            .isRetry(req.isRetry())
            .build();
        spinResultRepo.save(result);

        return SpinResponse.builder()
            .rewardKey(reward.getKey())
            .rewardLabel(reward.getLabel())
            .rewardPoints(reward.getPoints())
            .canDouble(true)
            .build();
    }

    @Transactional
    public DoubleResponse doubleUp(DoubleRequest req) {
        SpinResult result = spinResultRepo.findBySessionId(req.getSessionId())
            .orElseThrow(() -> new IllegalArgumentException("Spin result not found"));

        // 꽝 80% (0~7999), 다시하기 15% (8000~9499), 2배 5% (9500~9999)
        int roll = secureRandom.nextInt(10000);
        int finalPoints;
        String message;
        boolean success;
        boolean retry = false;

        if (roll < 8000) {
            // 꽝 80%
            success = false;
            finalPoints = result.getRewardPoints();
            message = "아쉽네요! 원래 포인트 " + finalPoints + "P를 드립니다.";
        } else if (roll < 9500) {
            // 다시하기 15%
            success = false;
            retry = true;
            finalPoints = result.getRewardPoints();
            message = "다시 한 번! 포인트 " + finalPoints + "P를 드립니다.";
        } else {
            // 2배 5%
            success = true;
            finalPoints = result.getRewardPoints() * 2;
            message = "2배 성공! " + finalPoints + "P 획득!";
        }
        result.setRewardPoints(finalPoints);
        spinResultRepo.save(result);

        return DoubleResponse.builder()
            .success(success)
            .retry(retry)
            .finalPoints(finalPoints)
            .message(message)
            .build();
    }

    @Transactional
    public ClaimResponse claim(ClaimRequest req) {
        if (!req.isPrivacyAgree()) {
            throw new IllegalArgumentException("개인정보 동의가 필요합니다");
        }

        SpinResult spinResult = spinResultRepo.findBySessionId(req.getSessionId())
            .orElseThrow(() -> new IllegalArgumentException("Spin result not found"));

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        if (ptRepo.existsByPhoneNumberAndDate(req.getPhoneNumber(), today)) {
            throw new IllegalStateException("오늘 이미 포인트를 받으셨습니다");
        }

        Customer customer = customerRepo.findByPhoneNumber(req.getPhoneNumber()).orElseGet(() -> {
            Customer c = Customer.builder()
                .phoneNumber(req.getPhoneNumber())
                .marketingAgree(req.isMarketingAgree())
                .build();
            return customerRepo.save(c);
        });
        if (req.isMarketingAgree() && !Boolean.TRUE.equals(customer.getMarketingAgree())) {
            customer.setMarketingAgree(true);
            customerRepo.save(customer);
        }

        int earned = spinResult.getRewardPoints();
        PointTransaction tx = PointTransaction.builder()
            .customer(customer)
            .sessionId(req.getSessionId())
            .points(earned)
            .txType("EARN")
            .description("단백깡 이벤트 - " + spinResult.getRewardLabel())
            .build();
        ptRepo.save(tx);

        long totalPoints = ptRepo.sumPointsByCustomer(customer.getId());

        return ClaimResponse.builder()
            .success(true)
            .earnedPoints(earned)
            .totalPoints((int) totalPoints)
            .message(earned + "P가 적립되었습니다!")
            .build();
    }

    private EventProps.RewardConfig pickReward() {
        List<EventProps.RewardConfig> rewards = eventProps.getRewards();
        int totalWeight = rewards.stream().mapToInt(EventProps.RewardConfig::getWeight).sum();
        int rand = secureRandom.nextInt(totalWeight);
        int cumulative = 0;
        for (EventProps.RewardConfig r : rewards) {
            cumulative += r.getWeight();
            if (rand < cumulative) return r;
        }
        return rewards.get(rewards.size() - 1);
    }
}
