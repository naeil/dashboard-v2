package kr.co.highfree.event.dto;

import jakarta.validation.constraints.*;
import java.util.UUID;

public class Dtos {

    public static class SessionRequest {
        private String qrId, country, channel, product, flavor, campaign, referrer;
        public SessionRequest() {}
        public String getQrId() { return qrId; }
        public void setQrId(String v) { this.qrId = v; }
        public String getCountry() { return country; }
        public void setCountry(String v) { this.country = v; }
        public String getChannel() { return channel; }
        public void setChannel(String v) { this.channel = v; }
        public String getProduct() { return product; }
        public void setProduct(String v) { this.product = v; }
        public String getFlavor() { return flavor; }
        public void setFlavor(String v) { this.flavor = v; }
        public String getCampaign() { return campaign; }
        public void setCampaign(String v) { this.campaign = v; }
        public String getReferrer() { return referrer; }
        public void setReferrer(String v) { this.referrer = v; }
        public static Builder builder() { return new Builder(); }
        public static class Builder {
            private final SessionRequest o = new SessionRequest();
            public Builder qrId(String v) { o.qrId=v; return this; }
            public Builder country(String v) { o.country=v; return this; }
            public Builder channel(String v) { o.channel=v; return this; }
            public Builder product(String v) { o.product=v; return this; }
            public Builder flavor(String v) { o.flavor=v; return this; }
            public Builder campaign(String v) { o.campaign=v; return this; }
            public Builder referrer(String v) { o.referrer=v; return this; }
            public SessionRequest build() { return o; }
        }
    }

    public static class SessionResponse {
        private UUID sessionId;
        private boolean alreadySpun;
        public SessionResponse() {}
        public UUID getSessionId() { return sessionId; }
        public void setSessionId(UUID v) { this.sessionId = v; }
        public boolean isAlreadySpun() { return alreadySpun; }
        public void setAlreadySpun(boolean v) { this.alreadySpun = v; }
        public static Builder builder() { return new Builder(); }
        public static class Builder {
            private final SessionResponse o = new SessionResponse();
            public Builder sessionId(UUID v) { o.sessionId=v; return this; }
            public Builder alreadySpun(boolean v) { o.alreadySpun=v; return this; }
            public SessionResponse build() { return o; }
        }
    }

    public static class SpinRequest {
        @NotNull private UUID sessionId;
        private boolean retry;
        public SpinRequest() {}
        public UUID getSessionId() { return sessionId; }
        public void setSessionId(UUID v) { this.sessionId = v; }
        public boolean isRetry() { return retry; }
        public void setRetry(boolean v) { this.retry = v; }
    }

    public static class SpinResponse {
        private String rewardKey, rewardLabel;
        private int rewardPoints;
        private boolean canDouble;
        public SpinResponse() {}
        public String getRewardKey() { return rewardKey; }
        public void setRewardKey(String v) { this.rewardKey = v; }
        public String getRewardLabel() { return rewardLabel; }
        public void setRewardLabel(String v) { this.rewardLabel = v; }
        public int getRewardPoints() { return rewardPoints; }
        public void setRewardPoints(int v) { this.rewardPoints = v; }
        public boolean isCanDouble() { return canDouble; }
        public void setCanDouble(boolean v) { this.canDouble = v; }
        public static Builder builder() { return new Builder(); }
        public static class Builder {
            private final SpinResponse o = new SpinResponse();
            public Builder rewardKey(String v) { o.rewardKey=v; return this; }
            public Builder rewardLabel(String v) { o.rewardLabel=v; return this; }
            public Builder rewardPoints(int v) { o.rewardPoints=v; return this; }
            public Builder canDouble(boolean v) { o.canDouble=v; return this; }
            public SpinResponse build() { return o; }
        }
    }

    public static class DoubleRequest {
        @NotNull private UUID sessionId;
        public DoubleRequest() {}
        public UUID getSessionId() { return sessionId; }
        public void setSessionId(UUID v) { this.sessionId = v; }
    }

    public static class DoubleResponse {
        private boolean success;
        private int finalPoints;
        private String message;
        public DoubleResponse() {}
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean v) { this.success = v; }
        public int getFinalPoints() { return finalPoints; }
        public void setFinalPoints(int v) { this.finalPoints = v; }
        public String getMessage() { return message; }
        public void setMessage(String v) { this.message = v; }
        public static Builder builder() { return new Builder(); }
        public static class Builder {
            private final DoubleResponse o = new DoubleResponse();
            public Builder success(boolean v) { o.success=v; return this; }
            public Builder finalPoints(int v) { o.finalPoints=v; return this; }
            public Builder message(String v) { o.message=v; return this; }
            public DoubleResponse build() { return o; }
        }
    }

    public static class ClaimRequest {
        @NotNull private UUID sessionId;
        @NotBlank @Pattern(regexp="^01[016789]\\d{7,8}$") private String phoneNumber;
        private boolean privacyAgree, marketingAgree;
        public ClaimRequest() {}
        public UUID getSessionId() { return sessionId; }
        public void setSessionId(UUID v) { this.sessionId = v; }
        public String getPhoneNumber() { return phoneNumber; }
        public void setPhoneNumber(String v) { this.phoneNumber = v; }
        public boolean isPrivacyAgree() { return privacyAgree; }
        public void setPrivacyAgree(boolean v) { this.privacyAgree = v; }
        public boolean isMarketingAgree() { return marketingAgree; }
        public void setMarketingAgree(boolean v) { this.marketingAgree = v; }
    }

    public static class ClaimResponse {
        private boolean success;
        private int earnedPoints, totalPoints;
        private String message;
        public ClaimResponse() {}
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean v) { this.success = v; }
        public int getEarnedPoints() { return earnedPoints; }
        public void setEarnedPoints(int v) { this.earnedPoints = v; }
        public int getTotalPoints() { return totalPoints; }
        public void setTotalPoints(int v) { this.totalPoints = v; }
        public String getMessage() { return message; }
        public void setMessage(String v) { this.message = v; }
        public static Builder builder() { return new Builder(); }
        public static class Builder {
            private final ClaimResponse o = new ClaimResponse();
            public Builder success(boolean v) { o.success=v; return this; }
            public Builder earnedPoints(int v) { o.earnedPoints=v; return this; }
            public Builder totalPoints(int v) { o.totalPoints=v; return this; }
            public Builder message(String v) { o.message=v; return this; }
            public ClaimResponse build() { return o; }
        }
    }

    public static class AdminSummary {
        private long totalScans, totalSpins, totalClaims, totalPointsEarned;
        private double conversionRate;
        public AdminSummary() {}
        public long getTotalScans() { return totalScans; }
        public void setTotalScans(long v) { this.totalScans = v; }
        public long getTotalSpins() { return totalSpins; }
        public void setTotalSpins(long v) { this.totalSpins = v; }
        public long getTotalClaims() { return totalClaims; }
        public void setTotalClaims(long v) { this.totalClaims = v; }
        public long getTotalPointsEarned() { return totalPointsEarned; }
        public void setTotalPointsEarned(long v) { this.totalPointsEarned = v; }
        public double getConversionRate() { return conversionRate; }
        public void setConversionRate(double v) { this.conversionRate = v; }
        public static Builder builder() { return new Builder(); }
        public static class Builder {
            private final AdminSummary o = new AdminSummary();
            public Builder totalScans(long v) { o.totalScans=v; return this; }
            public Builder totalSpins(long v) { o.totalSpins=v; return this; }
            public Builder totalClaims(long v) { o.totalClaims=v; return this; }
            public Builder totalPointsEarned(long v) { o.totalPointsEarned=v; return this; }
            public Builder conversionRate(double v) { o.conversionRate=v; return this; }
            public AdminSummary build() { return o; }
        }
    }
}
