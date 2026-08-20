package naeil.dashboard.common.finance;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * CFO 재무관리 중앙 계산 모듈.
 *
 * 모든 재무 계산식은 이 클래스에 단 한 번만 정의한다 (서비스/화면에 중복 작성 금지).
 * 규칙:
 *  - 금액은 BigDecimal 만 사용한다 (double 금지).
 *  - 0으로 나누기 / null / 음수 입력은 예외를 던지지 않고 null 또는 안전값을 반환한다.
 *  - null 반환은 "계산 불가(데이터 없음)"를 의미하며, 화면은 0이 아니라 '데이터 없음'으로 표시한다.
 */
public final class FinanceCalculator {

    private FinanceCalculator() {
    }

    public static final int MONEY_SCALE = 0;   // 원 단위
    public static final int RATE_SCALE = 2;    // % 소수 2자리

    public static BigDecimal nvl(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    /** 안전 나눗셈: 분모가 null/0 이면 null. */
    public static BigDecimal safeDivide(BigDecimal numerator, BigDecimal denominator, int scale) {
        if (numerator == null || denominator == null || denominator.signum() == 0) {
            return null;
        }
        return numerator.divide(denominator, scale, RoundingMode.HALF_UP);
    }

    /** 순매출 = 총매출 − 할인 − 쿠폰 − 반품/환불 − 기타 차감. */
    public static BigDecimal netSales(BigDecimal grossSales, BigDecimal discount, BigDecimal coupon,
                                      BigDecimal refund, BigDecimal otherDeduction) {
        return nvl(grossSales).subtract(nvl(discount)).subtract(nvl(coupon))
                .subtract(nvl(refund)).subtract(nvl(otherDeduction));
    }

    /** 매출총이익 = 순매출 − 매출원가. */
    public static BigDecimal grossProfit(BigDecimal netSales, BigDecimal cogs) {
        return nvl(netSales).subtract(nvl(cogs));
    }

    /** 공헌이익 = 순매출 − 매출원가 − 판매변동비. */
    public static BigDecimal contributionProfit(BigDecimal netSales, BigDecimal cogs, BigDecimal variableSellingCost) {
        return nvl(netSales).subtract(nvl(cogs)).subtract(nvl(variableSellingCost));
    }

    /** 영업이익 = 공헌이익 − 고정비 − 기타 판관비. */
    public static BigDecimal operatingProfit(BigDecimal contributionProfit, BigDecimal fixedCost, BigDecimal otherSgna) {
        return nvl(contributionProfit).subtract(nvl(fixedCost)).subtract(nvl(otherSgna));
    }

    /** 비율(%) = 부분 ÷ 전체 × 100. 전체가 0/null 이면 null. */
    public static BigDecimal ratioPct(BigDecimal part, BigDecimal whole) {
        BigDecimal ratio = safeDivide(nvl(part).multiply(BigDecimal.valueOf(100)), whole, RATE_SCALE);
        return ratio;
    }

    /** 전월 대비 증감률(%) = (당월 − 전월) ÷ |전월| × 100. 전월이 0/null 이면 null. */
    public static BigDecimal changePct(BigDecimal current, BigDecimal previous) {
        if (previous == null || previous.signum() == 0 || current == null) {
            return null;
        }
        return current.subtract(previous)
                .multiply(BigDecimal.valueOf(100))
                .divide(previous.abs(), RATE_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * 손익분기점 매출 = 월 고정비 ÷ (공헌이익률/100).
     * 공헌이익률이 0 이하이거나 null 이면 계산 불가(null).
     */
    public static BigDecimal breakEvenRevenue(BigDecimal monthlyFixedCost, BigDecimal contributionMarginPct) {
        if (monthlyFixedCost == null || contributionMarginPct == null || contributionMarginPct.signum() <= 0) {
            return null;
        }
        return monthlyFixedCost.multiply(BigDecimal.valueOf(100))
                .divide(contributionMarginPct, MONEY_SCALE, RoundingMode.HALF_UP);
    }

    /** 손익분기 판매수량 = 월 고정비 ÷ 개당 공헌이익. 개당 공헌이익 ≤ 0 이면 null. */
    public static BigDecimal breakEvenUnits(BigDecimal monthlyFixedCost, BigDecimal unitContribution) {
        if (monthlyFixedCost == null || unitContribution == null || unitContribution.signum() <= 0) {
            return null;
        }
        return monthlyFixedCost.divide(unitContribution, 0, RoundingMode.CEILING);
    }

    /**
     * 현금 런웨이(개월) = 사용 가능 현금 ÷ 월 평균 순현금유출.
     * 순유출이 0 이하(현금이 늘고 있음)면 null 을 반환한다 — 화면에서는 "현금 소진 없음"으로 표시.
     */
    public static BigDecimal runwayMonths(BigDecimal availableCash, BigDecimal avgMonthlyNetOutflow) {
        if (availableCash == null || avgMonthlyNetOutflow == null || avgMonthlyNetOutflow.signum() <= 0) {
            return null;
        }
        return availableCash.divide(avgMonthlyNetOutflow, 1, RoundingMode.DOWN);
    }

    /**
     * 개당 공헌이익 = 실판매가 − 개당 원가 − 개당 채널수수료 − 개당 결제수수료
     *              − 개당 광고비 − 개당 물류/배송비 − 개당 기타 변동비.
     */
    public static BigDecimal unitContribution(BigDecimal unitPrice, BigDecimal unitCost, BigDecimal unitChannelFee,
                                              BigDecimal unitPaymentFee, BigDecimal unitAdCost,
                                              BigDecimal unitLogistics, BigDecimal unitOtherVariable) {
        if (unitPrice == null) {
            return null;
        }
        return unitPrice.subtract(nvl(unitCost)).subtract(nvl(unitChannelFee)).subtract(nvl(unitPaymentFee))
                .subtract(nvl(unitAdCost)).subtract(nvl(unitLogistics)).subtract(nvl(unitOtherVariable));
    }

    /** 수수료액 = 금액 × 요율(%) ÷ 100. */
    public static BigDecimal feeAmount(BigDecimal amount, BigDecimal ratePct) {
        if (amount == null || ratePct == null) {
            return BigDecimal.ZERO;
        }
        return amount.multiply(ratePct).divide(BigDecimal.valueOf(100), MONEY_SCALE, RoundingMode.HALF_UP);
    }

    /** 부가세 포함 금액 → 공급가액 (기본 10%). */
    public static BigDecimal supplyAmountFromVatIncluded(BigDecimal vatIncluded) {
        if (vatIncluded == null) {
            return null;
        }
        return vatIncluded.multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(110), MONEY_SCALE, RoundingMode.HALF_UP);
    }

    /** 미수금 연령 버킷: 0-30 / 31-60 / 61-90 / 91-180 / 181+ / (음수 = 기한 전). */
    public static String agingBucket(long daysOverdue) {
        if (daysOverdue <= 0) return "기한 전";
        if (daysOverdue <= 30) return "0~30일";
        if (daysOverdue <= 60) return "31~60일";
        if (daysOverdue <= 90) return "61~90일";
        if (daysOverdue <= 180) return "91~180일";
        return "181일 이상";
    }

    /**
     * 상품 상태 자동 분류.
     * 기준(관리자 설정으로 조정 가능하도록 파라미터화):
     *  - 적자: 공헌이익 < 0
     *  - 스타: 매출 상위(share ≥ starSharePct) & 공헌이익률 ≥ goodMarginPct
     *  - 매출형: 매출 상위인데 공헌이익률 < lowMarginPct
     *  - 효자: 매출 하위지만 공헌이익률 ≥ goodMarginPct
     *  - 개선 필요: 공헌이익률 < lowMarginPct
     *  - 정상: 그 외
     */
    public static String classifyProduct(BigDecimal revenueSharePct, BigDecimal contributionMarginPct,
                                         BigDecimal starSharePct, BigDecimal goodMarginPct, BigDecimal lowMarginPct) {
        if (contributionMarginPct == null) return "분류 불가";
        if (contributionMarginPct.signum() < 0) return "적자 상품";
        boolean highShare = revenueSharePct != null && starSharePct != null
                && revenueSharePct.compareTo(starSharePct) >= 0;
        boolean goodMargin = goodMarginPct != null && contributionMarginPct.compareTo(goodMarginPct) >= 0;
        boolean lowMargin = lowMarginPct != null && contributionMarginPct.compareTo(lowMarginPct) < 0;
        if (highShare && goodMargin) return "스타 상품";
        if (highShare && lowMargin) return "매출형 상품";
        if (!highShare && goodMargin) return "효자 상품";
        if (lowMargin) return "개선 필요";
        return "정상";
    }

    /** KPI 상태: 위험/주의/정상. 값이 null 이면 "데이터 없음". */
    public static String kpiStatus(BigDecimal value, BigDecimal warnBelow, BigDecimal dangerBelow) {
        if (value == null) return "데이터 없음";
        if (dangerBelow != null && value.compareTo(dangerBelow) < 0) return "위험";
        if (warnBelow != null && value.compareTo(warnBelow) < 0) return "주의";
        return "정상";
    }

    /** 대출 월 이자 추정 = 잔액 × 연이율(%) ÷ 12 ÷ 100. */
    public static BigDecimal monthlyInterest(BigDecimal principalBalance, BigDecimal annualRatePct) {
        if (principalBalance == null || annualRatePct == null) {
            return null;
        }
        return principalBalance.multiply(annualRatePct)
                .divide(BigDecimal.valueOf(1200), MONEY_SCALE, RoundingMode.HALF_UP);
    }
}
