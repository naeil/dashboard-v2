package naeil.dashboard.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.entity.FieldAdCostEntry;
import naeil.dashboard.entity.FieldInventoryOrderEntry;
import naeil.dashboard.entity.FieldOtherCostEntry;
import naeil.dashboard.entity.FieldSalesEntry;
import naeil.dashboard.repository.FieldAdCostEntryRepository;
import naeil.dashboard.repository.FieldInventoryOrderEntryRepository;
import naeil.dashboard.repository.FieldOtherCostEntryRepository;
import naeil.dashboard.repository.FieldSalesEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * L1/L2 aggregation for the field-input (L0) layer.
   *
   * Rolls the raw entries typed in by operations staff up into product-level (L1)
   * and brand-level (L2) summaries: sales totals, ad ROAS/CPA, other-cost totals
   * and a simple operating-profit estimate (sales - ad cost - other cost).
   *
   * This is a first draft aggregation implemented with in-memory streams so it can
   * be reviewed and tested quickly. For larger data volumes the team should
   * replace this with proper SQL sum/group-by queries.
   */
@Service
  @RequiredArgsConstructor
  @Transactional(readOnly = true)
  public class FieldDataAggregationService {

private final FieldSalesEntryRepository salesRepository;
    private final FieldAdCostEntryRepository adCostRepository;
    private final FieldInventoryOrderEntryRepository inventoryRepository;
    private final FieldOtherCostEntryRepository otherCostRepository;

public Map<String, Object> getSummary(Long companyId, LocalDate startDate, LocalDate endDate) {
  List<FieldSalesEntry> sales =
    salesRepository.findAllByCompanyIdAndEntryDateBetweenOrderByEntryDateDesc(companyId, startDate, endDate);
  List<FieldAdCostEntry> adCosts =
    adCostRepository.findAllByCompanyIdAndEntryDateBetweenOrderByEntryDateDesc(companyId, startDate, endDate);
  List<FieldOtherCostEntry> otherCosts =
    otherCostRepository.findAllByCompanyIdAndEntryDateBetweenOrderByEntryDateDesc(companyId, startDate, endDate);
  List<FieldInventoryOrderEntry> inventoryEntries =
    inventoryRepository.findAllByCompanyIdAndEntryDateBetweenOrderByEntryDateDesc(companyId, startDate, endDate);

    BigDecimal totalSalesAmount = sales.stream()
      .map(FieldSalesEntry::getSalesAmount)
      .filter(java.util.Objects::nonNull)
      .reduce(BigDecimal.ZERO, BigDecimal::add);
  long totalSalesQuantity = sales.stream()
    .mapToLong(entry -> entry.getQuantity() == null ? 0L : entry.getQuantity())
    .sum();

    BigDecimal totalAdCost = adCosts.stream()
      .map(FieldAdCostEntry::getAdCostAmount)
      .filter(java.util.Objects::nonNull)
      .reduce(BigDecimal.ZERO, BigDecimal::add);
  long totalConversions = adCosts.stream()
    .mapToLong(entry -> entry.getConversions() == null ? 0L : entry.getConversions())
    .sum();
  long totalClicks = adCosts.stream()
    .mapToLong(entry -> entry.getClicks() == null ? 0L : entry.getClicks())
    .sum();
  long totalImpressions = adCosts.stream()
    .mapToLong(entry -> entry.getImpressions() == null ? 0L : entry.getImpressions())
    .sum();

BigDecimal totalCostAmount = sales.stream()
          .map(FieldSalesEntry::getCostAmount)
          .filter(java.util.Objects::nonNull)
          .reduce(BigDecimal.ZERO, BigDecimal::add);
  
      BigDecimal totalOtherCost = otherCosts.stream()
      .map(FieldOtherCostEntry::getAmount)
      .filter(java.util.Objects::nonNull)
      .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal operatingProfit = totalSalesAmount.subtract(totalCostAmount).subtract(totalAdCost).subtract(totalOtherCost);

    BigDecimal roas = totalAdCost.signum() > 0
      ? totalSalesAmount.divide(totalAdCost, 4, RoundingMode.HALF_UP)
      : BigDecimal.ZERO;
  BigDecimal cpa = totalConversions > 0
    ? totalAdCost.divide(BigDecimal.valueOf(totalConversions), 2, RoundingMode.HALF_UP)
    : BigDecimal.ZERO;

    long inboundQuantity = inventoryEntries.stream()
      .filter(entry -> "INBOUND".equalsIgnoreCase(entry.getEntryType()))
      .mapToLong(entry -> entry.getQuantity() == null ? 0L : entry.getQuantity())
      .sum();
  long outboundQuantity = inventoryEntries.stream()
    .filter(entry -> "OUTBOUND".equalsIgnoreCase(entry.getEntryType()))
    .mapToLong(entry -> entry.getQuantity() == null ? 0L : entry.getQuantity())
    .sum();
  long orderRequestCount = inventoryEntries.stream()
    .filter(entry -> "ORDER_REQUEST".equalsIgnoreCase(entry.getEntryType()))
    .count();

    Map<String, Object> summary = new LinkedHashMap<>();
  summary.put("startDate", startDate);
  summary.put("endDate", endDate);
  summary.put("totalSalesAmount", totalSalesAmount);
  summary.put("totalSalesQuantity", totalSalesQuantity);
  summary.put("totalAdCost", totalAdCost);
  summary.put("totalOtherCost", totalOtherCost);
      summary.put("totalCostAmount", totalCostAmount);
  summary.put("operatingProfit", operatingProfit);
  summary.put("roas", roas);
  summary.put("cpa", cpa);
  summary.put("totalClicks", totalClicks);
  summary.put("totalImpressions", totalImpressions);
  summary.put("totalConversions", totalConversions);
  summary.put("inboundQuantity", inboundQuantity);
  summary.put("outboundQuantity", outboundQuantity);
  summary.put("orderRequestCount", orderRequestCount);
  summary.put("byProduct", buildProductBreakdown(sales, adCosts));
  summary.put("byBrand", buildBrandBreakdown(sales, adCosts, otherCosts));
  return summary;
}

private List<Map<String, Object>> buildProductBreakdown(
  List<FieldSalesEntry> sales, List<FieldAdCostEntry> adCosts) {
  Map<Long, BigDecimal> salesByProduct = new HashMap<>();
  Map<Long, BigDecimal> adCostByProduct = new HashMap<>();

    for (FieldSalesEntry entry : sales) {
      if (entry.getProductId() == null || entry.getSalesAmount() == null) {
        continue;
      }
      salesByProduct.merge(entry.getProductId(), entry.getSalesAmount(), BigDecimal::add);
    }
  for (FieldAdCostEntry entry : adCosts) {
    if (entry.getProductId() == null || entry.getAdCostAmount() == null) {
      continue;
    }
    adCostByProduct.merge(entry.getProductId(), entry.getAdCostAmount(), BigDecimal::add);
  }

    List<Long> productIds = new ArrayList<>();
  productIds.addAll(salesByProduct.keySet());
  for (Long productId : adCostByProduct.keySet()) {
    if (!productIds.contains(productId)) {
      productIds.add(productId);
    }
  }

    List<Map<String, Object>> result = new ArrayList<>();
  for (Long productId : productIds) {
    BigDecimal productSales = salesByProduct.getOrDefault(productId, BigDecimal.ZERO);
    BigDecimal productAdCost = adCostByProduct.getOrDefault(productId, BigDecimal.ZERO);
    BigDecimal productRoas = productAdCost.signum() > 0
      ? productSales.divide(productAdCost, 4, RoundingMode.HALF_UP)
      : BigDecimal.ZERO;

  Map<String, Object> row = new LinkedHashMap<>();
    row.put("productId", productId);
    row.put("salesAmount", productSales);
    row.put("adCostAmount", productAdCost);
    row.put("roas", productRoas);
    result.add(row);
  }
  result.sort(Comparator.comparing(
    (Map<String, Object> row) -> (BigDecimal) row.get("salesAmount")).reversed());
  return result;
}

private List<Map<String, Object>> buildBrandBreakdown(
  List<FieldSalesEntry> sales, List<FieldAdCostEntry> adCosts, List<FieldOtherCostEntry> otherCosts) {
  Map<Long, BigDecimal> salesByBrand = new HashMap<>();
  Map<Long, BigDecimal> adCostByBrand = new HashMap<>();
  Map<Long, BigDecimal> otherCostByBrand = new HashMap<>();
      Map<Long, BigDecimal> costByBrand = new HashMap<>();

    for (FieldSalesEntry entry : sales) {
      if (entry.getBrandId() == null || entry.getSalesAmount() == null) {
        continue;
      }
      salesByBrand.merge(entry.getBrandId(), entry.getSalesAmount(), BigDecimal::add);
            if (entry.getCostAmount() != null) {
                      costByBrand.merge(entry.getBrandId(), entry.getCostAmount(), BigDecimal::add);
            }
    }
  for (FieldAdCostEntry entry : adCosts) {
    if (entry.getBrandId() == null || entry.getAdCostAmount() == null) {
      continue;
    }
    adCostByBrand.merge(entry.getBrandId(), entry.getAdCostAmount(), BigDecimal::add);
  }
  for (FieldOtherCostEntry entry : otherCosts) {
    if (entry.getBrandId() == null || entry.getAmount() == null) {
      continue;
    }
    otherCostByBrand.merge(entry.getBrandId(), entry.getAmount(), BigDecimal::add);
  }

    List<Long> brandIds = new ArrayList<>();
  brandIds.addAll(salesByBrand.keySet());
  for (Long brandId : adCostByBrand.keySet()) {
    if (!brandIds.contains(brandId)) {
      brandIds.add(brandId);
    }
  }
  for (Long brandId : otherCostByBrand.keySet()) {
    if (!brandIds.contains(brandId)) {
      brandIds.add(brandId);
    }
  }
      for (Long brandId : costByBrand.keySet()) {
              if (!brandIds.contains(brandId)) {
                        brandIds.add(brandId);
              }
      }

    List<Map<String, Object>> result = new ArrayList<>();
  for (Long brandId : brandIds) {
    BigDecimal brandSales = salesByBrand.getOrDefault(brandId, BigDecimal.ZERO);
    BigDecimal brandAdCost = adCostByBrand.getOrDefault(brandId, BigDecimal.ZERO);
    BigDecimal brandOtherCost = otherCostByBrand.getOrDefault(brandId, BigDecimal.ZERO);
        BigDecimal brandCost = costByBrand.getOrDefault(brandId, BigDecimal.ZERO);
          BigDecimal brandProfit = brandSales.subtract(brandCost).subtract(brandAdCost).subtract(brandOtherCost);

  Map<String, Object> row = new LinkedHashMap<>();
    row.put("brandId", brandId);
    row.put("salesAmount", brandSales);
    row.put("adCostAmount", brandAdCost);
    row.put("otherCostAmount", brandOtherCost);
        row.put("costAmount", brandCost);
    row.put("operatingProfit", brandProfit);
    result.add(row);
  }
  result.sort(Comparator.comparing(
    (Map<String, Object> row) -> (BigDecimal) row.get("operatingProfit")).reversed());
  return result;
}
  }
