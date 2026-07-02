package kr.co.highfree.event.service;

import kr.co.highfree.event.config.EventProps;
import kr.co.highfree.event.domain.*;
import kr.co.highfree.event.dto.Dtos.*;
import kr.co.highfree.event.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EventService {

    private final EventProps eventProps;
    private final QrCodeRepository qrCodeRepo;
    private final EventSessionRepository sessionRepo;
    private final SpinResultRepository spinResultRepo;
    private final CustomerRepository customerRepo;
    private final PointTransactionRepository ptRepo;
    private final SecureRandom secureRandom = new SecureRandom();

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
        EventSession session = sessionRepo.findBySessionId(req.getSessionId())
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

        boolean success = secureRandom.nextBoolean();
        int finalPoints;
        String message;
        if (success) {
            finalPoints = result.getRewardPoints() * 2;
            message = "2배 성공! " + finalPoints + "P 획득!";
        } else {
            finalPoints = 100;
            message = "아쉽네요. 기본 100P 드립니다!";
        }
        result.setRewardPoints(finalPoints);
        spinResultRepo.save(result);

        return DoubleResponse.builder()
                .success(success)
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

        Customer customer = customerRepo.findByPhoneNumber(req.getPhoneNumber())
                .orElseGet(() -> customerRepo.save(Customer.builder()
                        .phoneNumber(req.getPhoneNumber())
                        .marketingAgree(req.isMarketingAgree())
                        .build()));

        customer.setMarketingAgree(req.isMarketingAgree());
        customerRepo.save(customer);

        if (ptRepo.existsTodayEarnByCustomer(customer.getId())) {
            throw new IllegalStateException("오늘 이미 포인트를 적립하셨습니다");
        }

        PointTransaction pt = PointTransaction.builder()
                .customerId(customer.getId())
                .sessionId(req.getSessionId())
                .type("EARN")
                .point(spinResult.getRewardPoints())
                .description("단백깡 이벤트 " + spinResult.getRewardLabel())
                .build();
        ptRepo.save(pt);

        int total = ptRepo.sumEarnByCustomerId(customer.getId()).orElse(0);
        return ClaimResponse.builder()
                .success(true)
                .earnedPoints(spinResult.getRewardPoints())
                .totalPoints(total)
                .message("포인트가 적립되었습니다!")
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
