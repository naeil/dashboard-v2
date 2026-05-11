package naeil.dashboard.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import naeil.dashboard.dto.BrandSalesDTO;
import naeil.dashboard.dto.PlatformTrendSalesDTO;
import naeil.dashboard.dto.ProductSalesDTO;
import naeil.dashboard.dto.ProductMarketSalesDTO;
import naeil.dashboard.dto.SalesSummaryAggregateDTO;
import naeil.dashboard.dto.ShopBrandSalesDTO;
import naeil.dashboard.dto.ShopSalesDTO;
import naeil.dashboard.entity.DailySalesStats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DailySalesStatsRepository extends JpaRepository<DailySalesStats, Long> {

    void deleteByCompanyId(Long companyId);

    Optional<DailySalesStats> findByCompanyIdAndDateAndShopIdAndBrandIdAndProductId(
            Long companyId,
            LocalDate date,
            Long shopId,
            Long brandId,
            Long productId
    );

    @Query("""
        SELECT ROUND(COALESCE(SUM(d.grossAmount), 0), 0) AS totalGrossAmount,
               ROUND(COALESCE(SUM(d.discountAmount), 0), 0) AS totalDiscountAmount,
               ROUND(COALESCE(SUM(d.netRevenue), 0), 0) AS totalNetRevenue,
               ROUND(COALESCE(SUM(d.shippingFee), 0), 0) AS totalShippingFee,
               ROUND(COALESCE(SUM(d.cancelAmount), 0), 0) AS totalCancelAmount,
               COALESCE(SUM(d.cancelCount), 0) AS cancelCount,
               COALESCE(SUM(d.ordererCount), 0) AS totalOrderCount,
               ROUND(COALESCE(SUM(
                   d.grossAmount
                   - (
                       (
                           COALESCE(p.costPrice, 0)
                           + COALESCE(profile.sgnaCost, 0)
                           + COALESCE(profile.logisticsCost, 0)
                           + COALESCE(profile.packagingCost, 0)
                           + COALESCE(profile.otherCost, 0)
                       ) * COALESCE(d.ordererCount, 0)
                   )
                   - (
                       CASE
                           WHEN channelCost.channelFeeType = 'RATE'
                               THEN d.grossAmount * COALESCE(channelCost.channelFeeValue, 0) / 100
                           ELSE COALESCE(channelCost.channelFeeValue, 0) * COALESCE(d.ordererCount, 0)
                       END
                   )
                   - (COALESCE(channelCost.adCost, 0) * COALESCE(d.ordererCount, 0))
                   - (COALESCE(channelCost.returnExchangeCost, 0) * COALESCE(d.ordererCount, 0))
               ), 0), 0) AS profitAmount
        FROM DailySalesStats d
        JOIN Product p ON p.id = d.productId
        LEFT JOIN ProductCostProfile profile
               ON profile.companyId = d.companyId
              AND profile.productId = d.productId
        LEFT JOIN ProductChannelCost channelCost
               ON channelCost.companyId = d.companyId
              AND channelCost.productId = d.productId
              AND channelCost.shopId = d.shopId
        WHERE d.companyId = :companyId
          AND (:brandId IS NULL OR d.brandId = :brandId)
          AND d.date BETWEEN :startDate AND :endDate
        """)
    SalesSummaryAggregateDTO findSummary(
            @Param("companyId") Long companyId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("brandId") Long brandId
    );

    @Query("""
        SELECT d.productId AS productId,
               p.productName AS productName,
               p.skuCd AS externalProductId,
               p.realStock AS currentRealStock,
               COALESCE(SUM(d.ordererCount), 0) AS totalOrderCount,
               ROUND(COALESCE(SUM(d.grossAmount), 0), 0) AS totalGrossAmount,
               ROUND(COALESCE(SUM(d.discountAmount), 0), 0) AS totalDiscountAmount,
               ROUND(COALESCE(SUM(d.netRevenue), 0), 0) AS totalNetRevenue,
               ROUND(COALESCE(SUM(d.shippingFee), 0), 0) AS totalShippingFee,
               ROUND(
                   CASE
                       WHEN COALESCE(SUM(d.ordererCount), 0) = 0 THEN 0
                       ELSE COALESCE(SUM(d.grossAmount), 0) / COALESCE(SUM(d.ordererCount), 0)
                   END,
                   0
               ) AS averageOrderValue,
               ROUND(COALESCE(SUM(
                   d.grossAmount
                   - (
                       (
                           COALESCE(p.costPrice, 0)
                           + COALESCE(profile.sgnaCost, 0)
                           + COALESCE(profile.logisticsCost, 0)
                           + COALESCE(profile.packagingCost, 0)
                           + COALESCE(profile.otherCost, 0)
                       ) * COALESCE(d.ordererCount, 0)
                   )
                   - (
                       CASE
                           WHEN channelCost.channelFeeType = 'RATE'
                               THEN d.grossAmount * COALESCE(channelCost.channelFeeValue, 0) / 100
                           ELSE COALESCE(channelCost.channelFeeValue, 0) * COALESCE(d.ordererCount, 0)
                       END
                   )
                   - (COALESCE(channelCost.adCost, 0) * COALESCE(d.ordererCount, 0))
                   - (COALESCE(channelCost.returnExchangeCost, 0) * COALESCE(d.ordererCount, 0))
               ), 0), 0) AS profitAmount
        FROM DailySalesStats d
        JOIN Product p ON p.id = d.productId
        LEFT JOIN ProductCostProfile profile
               ON profile.companyId = d.companyId
              AND profile.productId = d.productId
        LEFT JOIN ProductChannelCost channelCost
               ON channelCost.companyId = d.companyId
              AND channelCost.productId = d.productId
              AND channelCost.shopId = d.shopId
        WHERE d.companyId = :companyId
          AND (:brandId IS NULL OR d.brandId = :brandId)
          AND d.date BETWEEN :startDate AND :endDate
        GROUP BY d.productId, p.productName, p.skuCd, p.realStock
        ORDER BY totalGrossAmount DESC
        """)
    List<ProductSalesDTO> findSalesByProduct(
            @Param("companyId") Long companyId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("brandId") Long brandId
    );

    @Query("""
        SELECT d.shopId AS shopId,
               s.shopName AS shopName,
               s.shopCode AS shopCode,
               COALESCE(SUM(d.ordererCount), 0) AS totalOrderCount,
               ROUND(COALESCE(SUM(d.grossAmount), 0), 0) AS totalGrossAmount,
               ROUND(COALESCE(SUM(d.discountAmount), 0), 0) AS totalDiscountAmount,
               ROUND(COALESCE(SUM(d.netRevenue), 0), 0) AS totalNetRevenue,
               ROUND(COALESCE(SUM(d.shippingFee), 0), 0) AS totalShippingFee,
               ROUND(
                   CASE
                       WHEN COALESCE(SUM(d.ordererCount), 0) = 0 THEN 0
                       ELSE COALESCE(SUM(d.grossAmount), 0) / COALESCE(SUM(d.ordererCount), 0)
                   END,
                   0
               ) AS averageOrderValue,
               ROUND(COALESCE(SUM(
                   (
                       COALESCE(p.costPrice, 0)
                       + COALESCE(profile.sgnaCost, 0)
                       + COALESCE(profile.logisticsCost, 0)
                       + COALESCE(profile.packagingCost, 0)
                       + COALESCE(profile.otherCost, 0)
                   ) * COALESCE(d.ordererCount, 0)
               ), 0), 0) AS baseCostAmount,
               ROUND(COALESCE(SUM(
                   CASE
                       WHEN channelCost.channelFeeType = 'RATE'
                           THEN d.grossAmount * COALESCE(channelCost.channelFeeValue, 0) / 100
                       ELSE COALESCE(channelCost.channelFeeValue, 0) * COALESCE(d.ordererCount, 0)
                   END
               ), 0), 0) AS channelFeeAmount,
               ROUND(COALESCE(SUM(
                   COALESCE(channelCost.adCost, 0) * COALESCE(d.ordererCount, 0)
               ), 0), 0) AS adCostAmount,
               ROUND(COALESCE(SUM(
                   COALESCE(channelCost.returnExchangeCost, 0) * COALESCE(d.ordererCount, 0)
               ), 0), 0) AS returnExchangeCostAmount,
               ROUND(COALESCE(SUM(
                   d.grossAmount
                   - (
                       (
                           COALESCE(p.costPrice, 0)
                           + COALESCE(profile.sgnaCost, 0)
                           + COALESCE(profile.logisticsCost, 0)
                           + COALESCE(profile.packagingCost, 0)
                           + COALESCE(profile.otherCost, 0)
                       ) * COALESCE(d.ordererCount, 0)
                   )
                   - (
                       CASE
                           WHEN channelCost.channelFeeType = 'RATE'
                               THEN d.grossAmount * COALESCE(channelCost.channelFeeValue, 0) / 100
                           ELSE COALESCE(channelCost.channelFeeValue, 0) * COALESCE(d.ordererCount, 0)
                       END
                   )
                   - (COALESCE(channelCost.adCost, 0) * COALESCE(d.ordererCount, 0))
                   - (COALESCE(channelCost.returnExchangeCost, 0) * COALESCE(d.ordererCount, 0))
               ), 0), 0) AS profitAmount,
               COALESCE(channelCost.channelFeeType, 'RATE') AS channelFeeType,
               ROUND(COALESCE(channelCost.channelFeeValue, 0), 2) AS channelFeeValue,
               ROUND(COALESCE(channelCost.adCost, 0), 2) AS adCost,
               ROUND(COALESCE(channelCost.returnExchangeCost, 0), 2) AS returnExchangeCost,
               ROUND(COALESCE(p.productPrice, 0), 2) AS salePrice,
               ROUND(COALESCE(p.costPrice, 0), 2) AS costPrice,
               ROUND(COALESCE(p.supplyPrice, 0), 2) AS supplyPrice,
               ROUND(COALESCE(profile.sgnaCost, 0), 2) AS sgnaCost,
               ROUND(COALESCE(profile.logisticsCost, 0), 2) AS logisticsCost,
               ROUND(COALESCE(profile.packagingCost, 0), 2) AS packagingCost,
               ROUND(COALESCE(profile.otherCost, 0), 2) AS otherCost
        FROM DailySalesStats d
        JOIN Product p ON p.id = d.productId
        JOIN Shop s ON s.id = d.shopId
        LEFT JOIN ProductCostProfile profile
               ON profile.companyId = d.companyId
              AND profile.productId = d.productId
        LEFT JOIN ProductChannelCost channelCost
               ON channelCost.companyId = d.companyId
              AND channelCost.productId = d.productId
              AND channelCost.shopId = d.shopId
        WHERE d.companyId = :companyId
          AND d.productId = :productId
          AND d.date BETWEEN :startDate AND :endDate
        GROUP BY d.shopId, s.shopName, s.shopCode,
                 channelCost.channelFeeType, channelCost.channelFeeValue, channelCost.adCost, channelCost.returnExchangeCost,
                 p.productPrice, p.costPrice, p.supplyPrice,
                 profile.sgnaCost, profile.logisticsCost, profile.packagingCost, profile.otherCost
        ORDER BY totalGrossAmount DESC, s.shopName ASC
        """)
    List<ProductMarketSalesDTO> findSalesByProductAndShop(
            @Param("companyId") Long companyId,
            @Param("productId") Long productId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query("""
        SELECT d.brandId AS brandId,
               b.brandName AS brandName,
               ROUND(COALESCE(SUM(d.grossAmount), 0), 0) AS totalGrossAmount,
               ROUND(COALESCE(SUM(d.discountAmount), 0), 0) AS totalDiscountAmount,
               ROUND(COALESCE(SUM(d.netRevenue), 0), 0) AS totalNetRevenue,
               ROUND(COALESCE(SUM(d.shippingFee), 0), 0) AS totalShippingFee
        FROM DailySalesStats d
        JOIN Brand b ON b.id = d.brandId
        WHERE d.companyId = :companyId
          AND (:brandId IS NULL OR d.brandId = :brandId)
          AND d.date BETWEEN :startDate AND :endDate
        GROUP BY d.brandId, b.brandName
        ORDER BY totalGrossAmount DESC
        """)
    List<BrandSalesDTO> findSalesByBrand(
            @Param("companyId") Long companyId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("brandId") Long brandId
    );

    @Query("""
        SELECT d.shopId AS shopId,
               s.shopName AS shopName,
               s.shopCode AS shopCode,
               ROUND(COALESCE(SUM(d.grossAmount), 0), 0) AS totalGrossAmount,
               ROUND(COALESCE(SUM(d.discountAmount), 0), 0) AS totalDiscountAmount,
               ROUND(COALESCE(SUM(d.netRevenue), 0), 0) AS totalNetRevenue,
               ROUND(COALESCE(SUM(d.shippingFee), 0), 0) AS totalShippingFee
        FROM DailySalesStats d
        JOIN Shop s ON s.id = d.shopId
        WHERE d.companyId = :companyId
          AND (:brandId IS NULL OR d.brandId = :brandId)
          AND d.date BETWEEN :startDate AND :endDate
        GROUP BY d.shopId, s.shopName, s.shopCode
        ORDER BY totalGrossAmount DESC
        """)
    List<ShopSalesDTO> findSalesByShop(
            @Param("companyId") Long companyId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("brandId") Long brandId
    );

    @Query("""
        SELECT d.shopId AS shopId,
               s.shopName AS shopName,
               s.shopCode AS shopCode,
               d.brandId AS brandId,
               b.brandName AS brandName,
               ROUND(COALESCE(SUM(d.grossAmount), 0), 0) AS totalGrossAmount,
               ROUND(COALESCE(SUM(d.discountAmount), 0), 0) AS totalDiscountAmount,
               ROUND(COALESCE(SUM(d.netRevenue), 0), 0) AS totalNetRevenue,
               ROUND(COALESCE(SUM(d.shippingFee), 0), 0) AS totalShippingFee
        FROM DailySalesStats d
        JOIN Shop s ON s.id = d.shopId
        JOIN Brand b ON b.id = d.brandId
        WHERE d.companyId = :companyId
          AND (:brandId IS NULL OR d.brandId = :brandId)
          AND d.date BETWEEN :startDate AND :endDate
        GROUP BY d.shopId, s.shopName, s.shopCode, d.brandId, b.brandName
        ORDER BY totalGrossAmount DESC
        """)
    List<ShopBrandSalesDTO> findSalesByShopBrand(
            @Param("companyId") Long companyId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("brandId") Long brandId
    );

    @Query("""
        SELECT new naeil.dashboard.dto.PlatformTrendSalesDTO(
                   CAST(function('date_trunc', :granularity, d.date) as LocalDate),
                   s.platform,
                   ROUND(SUM(d.netRevenue), 0)
               )
        FROM DailySalesStats d
        JOIN Shop s ON s.id = d.shopId
        WHERE d.companyId = :companyId
          AND (:brandId IS NULL OR d.brandId = :brandId)
          AND d.date BETWEEN :startDate AND :endDate
        GROUP BY 1, 2
        ORDER BY 1 ASC
        """)
    List<PlatformTrendSalesDTO> findTrendByPlatform(
            @Param("companyId") Long companyId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("granularity") String granularity,
            @Param("brandId") Long brandId
    );
}
