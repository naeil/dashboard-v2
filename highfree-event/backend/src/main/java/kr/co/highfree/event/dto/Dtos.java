package kr.co.highfree.event.dto;

import lombok.*;
import jakarta.validation.constraints.*;

import java.util.UUID;

public class Dtos {

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SessionRequest {
        private String qrId;
        private String country;
        private String channel;
        private String product;
        private String flavor;
        private String campaign;
        private String referrer;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SessionResponse {
        private UUID sessionId;
        private boolean alreadySpun;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SpinRequest {
        @NotNull
        private UUID sessionId;
        private boolean retry;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SpinResponse {
        private String rewardKey;
        private String rewardLabel;
        private int rewardPoints;
        private boolean canDouble;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class DoubleRequest {
        @NotNull
        private UUID sessionId;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class DoubleResponse {
        private boolean success;
        private int finalPoints;
        private String message;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ClaimRequest {
        @NotNull
        private UUID sessionId;
        @NotBlank
        @Pattern(regexp = "^01[016789]\\d{7,8}$", message = "올바른 휴대폰 번호를 입력해주세요")
        private String phoneNumber;
        private boolean privacyAgree;
        private boolean marketingAgree;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ClaimResponse {
        private boolean success;
        private int earnedPoints;
        private int totalPoints;
        private String message;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AdminSummary {
        private long totalScans;
        private long totalSpins;
        private long totalClaims;
        private double conversionRate;
        private long totalPointsEarned;
    }
}
