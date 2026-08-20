package naeil.dashboard.common.finance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class FinanceCalculatorTest {

    private static BigDecimal d(String value) {
        return new BigDecimal(value);
    }

    // ── 매출 ──────────────────────────────────────────────

    @Test
    void netSales_subtractsAllDeductions() {
        BigDecimal result = FinanceCalculator.netSales(d("1000000"), d("50000"), d("10000"), d("30000"), d("5000"));
        assertEquals(0, result.compareTo(d("905000")));
    }

    @Test
    void netSales_treatsNullAsZero() {
        BigDecimal result = FinanceCalculator.netSales(d("1000000"), null, null, null, null);
        assertEquals(0, result.compareTo(d("1000000")));
    }

    // ── 이익 ──────────────────────────────────────────────

    @Test
    void grossProfit_basic() {
        assertEquals(0, FinanceCalculator.grossProfit(d("1000"), d("400")).compareTo(d("600")));
    }

    @Test
    void contributionProfit_subtractsVariableCosts() {
        assertEquals(0, FinanceCalculator.contributionProfit(d("1000"), d("400"), d("250")).compareTo(d("350")));
    }

    @Test
    void contributionProfit_canBeNegative() {
        assertEquals(0, FinanceCalculator.contributionProfit(d("1000"), d("800"), d("300")).compareTo(d("-100")));
    }

    @Test
    void operatingProfit_subtractsFixedAndSgna() {
        assertEquals(0, FinanceCalculator.operatingProfit(d("350"), d("200"), d("50")).compareTo(d("100")));
    }

    // ── 비율 / 0 나누기 ───────────────────────────────────

    @Test
    void ratioPct_normalCase() {
        assertEquals(0, FinanceCalculator.ratioPct(d("350"), d("1000")).compareTo(d("35.00")));
    }

    @Test
    void ratioPct_zeroDenominatorReturnsNull() {
        assertNull(FinanceCalculator.ratioPct(d("350"), BigDecimal.ZERO));
        assertNull(FinanceCalculator.ratioPct(d("350"), null));
    }

    @Test
    void safeDivide_zeroAndNullSafe() {
        assertNull(FinanceCalculator.safeDivide(d("100"), BigDecimal.ZERO, 2));
        assertNull(FinanceCalculator.safeDivide(null, d("5"), 2));
        assertEquals(0, FinanceCalculator.safeDivide(d("100"), d("8"), 2).compareTo(d("12.50")));
    }

    @Test
    void changePct_previousZeroReturnsNull() {
        assertNull(FinanceCalculator.changePct(d("100"), BigDecimal.ZERO));
        assertNull(FinanceCalculator.changePct(d("100"), null));
    }

    @Test
    void changePct_negativePreviousUsesAbsoluteBase() {
        // 전월 -100 → 당월 +50 : (50-(-100))/100 = +150%
        assertEquals(0, FinanceCalculator.changePct(d("50"), d("-100")).compareTo(d("150.00")));
    }

    // ── 손익분기점 ────────────────────────────────────────

    @Test
    void breakEvenRevenue_basic() {
        // 고정비 680만원, 공헌이익률 40% → BEP 1,700만원
        assertEquals(0, FinanceCalculator.breakEvenRevenue(d("6800000"), d("40")).compareTo(d("17000000")));
    }

    @Test
    void breakEvenRevenue_zeroOrNegativeMarginReturnsNull() {
        assertNull(FinanceCalculator.breakEvenRevenue(d("6800000"), BigDecimal.ZERO));
        assertNull(FinanceCalculator.breakEvenRevenue(d("6800000"), d("-10")));
        assertNull(FinanceCalculator.breakEvenRevenue(d("6800000"), null));
    }

    @Test
    void breakEvenUnits_ceilsUp() {
        // 고정비 100만원 ÷ 개당 공헌이익 3,000원 = 333.33 → 334개
        assertEquals(0, FinanceCalculator.breakEvenUnits(d("1000000"), d("3000")).compareTo(d("334")));
    }

    // ── 런웨이 ────────────────────────────────────────────

    @Test
    void runwayMonths_basic() {
        assertEquals(0, FinanceCalculator.runwayMonths(d("48000000"), d("10000000")).compareTo(d("4.8")));
    }

    @Test
    void runwayMonths_noBurnReturnsNull() {
        // 순유출이 0 이하이면 "현금 소진 없음" — 무한대로 표시하지 않는다
        assertNull(FinanceCalculator.runwayMonths(d("48000000"), BigDecimal.ZERO));
        assertNull(FinanceCalculator.runwayMonths(d("48000000"), d("-5000000")));
        assertNull(FinanceCalculator.runwayMonths(d("48000000"), null));
    }

    // ── 개당 공헌이익 / 수수료 ────────────────────────────

    @Test
    void unitContribution_subtractsAllUnitCosts() {
        BigDecimal result = FinanceCalculator.unitContribution(
                d("10000"), d("4000"), d("1100"), d("300"), d("500"), d("700"), d("200"));
        assertEquals(0, result.compareTo(d("3200")));
    }

    @Test
    void unitContribution_nullPriceReturnsNull() {
        assertNull(FinanceCalculator.unitContribution(null, d("4000"), null, null, null, null, null));
    }

    @Test
    void feeAmount_percentOfAmount() {
        // 100만원 × 10.8% = 108,000원
        assertEquals(0, FinanceCalculator.feeAmount(d("1000000"), d("10.8")).compareTo(d("108000")));
    }

    @Test
    void feeAmount_nullSafe() {
        assertEquals(0, FinanceCalculator.feeAmount(null, d("10")).compareTo(BigDecimal.ZERO));
        assertEquals(0, FinanceCalculator.feeAmount(d("1000"), null).compareTo(BigDecimal.ZERO));
    }

    // ── 부가세 ────────────────────────────────────────────

    @Test
    void supplyAmountFromVatIncluded_extractsSupplyPrice() {
        // 11,000원(부가세 포함) → 공급가액 10,000원
        assertEquals(0, FinanceCalculator.supplyAmountFromVatIncluded(d("11000")).compareTo(d("10000")));
    }

    // ── 미수금 연령 ───────────────────────────────────────

    @Test
    void agingBucket_boundaries() {
        assertEquals("기한 전", FinanceCalculator.agingBucket(0));
        assertEquals("기한 전", FinanceCalculator.agingBucket(-5));
        assertEquals("0~30일", FinanceCalculator.agingBucket(1));
        assertEquals("0~30일", FinanceCalculator.agingBucket(30));
        assertEquals("31~60일", FinanceCalculator.agingBucket(31));
        assertEquals("61~90일", FinanceCalculator.agingBucket(90));
        assertEquals("91~180일", FinanceCalculator.agingBucket(180));
        assertEquals("181일 이상", FinanceCalculator.agingBucket(181));
    }

    // ── 상품 분류 ─────────────────────────────────────────

    @Test
    void classifyProduct_lossProduct() {
        assertEquals("적자 상품", FinanceCalculator.classifyProduct(
                d("20"), d("-5"), d("10"), d("30"), d("10")));
    }

    @Test
    void classifyProduct_star() {
        assertEquals("스타 상품", FinanceCalculator.classifyProduct(
                d("15"), d("35"), d("10"), d("30"), d("10")));
    }

    @Test
    void classifyProduct_volumeProduct() {
        assertEquals("매출형 상품", FinanceCalculator.classifyProduct(
                d("15"), d("5"), d("10"), d("30"), d("10")));
    }

    @Test
    void classifyProduct_hiddenGem() {
        assertEquals("효자 상품", FinanceCalculator.classifyProduct(
                d("3"), d("40"), d("10"), d("30"), d("10")));
    }

    @Test
    void classifyProduct_nullMarginNotClassified() {
        assertEquals("분류 불가", FinanceCalculator.classifyProduct(
                d("15"), null, d("10"), d("30"), d("10")));
    }

    // ── 대출 이자 ─────────────────────────────────────────

    @Test
    void monthlyInterest_basic() {
        // 1억 × 4.8% ÷ 12 = 400,000원
        assertEquals(0, FinanceCalculator.monthlyInterest(d("100000000"), d("4.8")).compareTo(d("400000")));
    }

    @Test
    void monthlyInterest_nullSafe() {
        assertNull(FinanceCalculator.monthlyInterest(null, d("4.8")));
        assertNull(FinanceCalculator.monthlyInterest(d("100000000"), null));
    }
}
