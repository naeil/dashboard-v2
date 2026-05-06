package naeil.dashboard.repository;

import naeil.dashboard.dto.*;
import naeil.dashboard.entity.DailySalesStats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

import java.util.Optional;

public interface DailySalesStatsRepository extends JpaRepository<DailySalesStats, Long> {

    void deleteByCompanyId(Long companyId);

    Optional<DailySalesStats> findByCompanyIdAndDateAndShopIdAndBrandIdAndProductId(
        Long companyId, LocalDate date, Long shopId, Long brandId, Long productId
    );

    // ------------------------------------------------------------------
    // Summary KPI
    // ------------------------------------------------------------------
    @Query("""
        SELECT ROUND(COALESCE(SUM(d.grossAmount),    0), 0) AS totalGrossAmount,
               ROUND(COALESCE(SUM(d.discountAmount), 0), 0) AS totalDiscountAmount,
               ROUND(COALESCE(SUM(d.netRevenue),     0), 0) AS totalNetRevenue,
               ROUND(COALESCE(SUM(d.shippingFee),    0), 0) AS totalShippingFee,
               ROUND(COALESCE(SUM(d.cancelAmount),   0), 0) AS totalCancelAmount,
               COALESCE(SUM(d.cancelCount),    0) AS cancelCount,
               COALESCE(SUM(d.ordererCount),   0) AS totalOrderCount
        FROM DailySalesStats d
        WHERE d.companyId = :companyId
          AND (:brandId IS NULL OR d.brandId = :brandId)
          AND d.date BETWEEN :startDate AND :endDate
        """)
    SalesSummaryAggregateDTO findSummary(
        @Param("companyId") Long companyId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate")   LocalDate endDate,
        @Param("brandId") Long brandId
    );

    // ------------------------------------------------------------------
    // Product-level GROUP BY
    // ------------------------------------------------------------------
    @Query("""
        SELECT d.productId AS productId,
               p.productName AS productName,
               p.skuCd AS externalProductId,
               p.realStock AS currentRealStock,
               (
                   SELECT COUNT(DISTINCT o.customerId)
                   FROM Orders o
                   WHERE o.companyId = :companyId
                     AND (:brandId IS NULL OR o.brandId = :brandId)
                     AND o.productId = d.productId
                     AND o.customerId IS NOT NULL
                     AND o.ordStatus IN :includedStatuses
                     AND o.wdate >= :startDateTime
                     AND o.wdate < :endDateTime
               ) AS totalOrderCount,
               ROUND(COALESCE(SUM(d.grossAmount), 0), 0) AS totalGrossAmount,
               ROUND(COALESCE(SUM(d.discountAmount), 0), 0) AS totalDiscountAmount,
               ROUND(COALESCE(SUM(d.netRevenue), 0), 0) AS totalNetRevenue,
               ROUND(COALESCE(SUM(d.shippingFee), 0), 0) AS totalShippingFee,
               ROUND(
                   CASE
                       WHEN (
                           SELECT COUNT(DISTINCT o2.customerId)
                           FROM Orders o2
                           WHERE o2.companyId = :companyId
                             AND (:brandId IS NULL OR o2.brandId = :brandId)
                             AND o2.productId = d.productId
                             AND o2.customerId IS NOT NULL
                             AND o2.ordStatus IN :includedStatuses
                             AND o2.wdate >= :startDateTime
                             AND o2.wdate < :endDateTime
                       ) = 0 THEN 0
                       ELSE COALESCE(SUM(d.grossAmount), 0) / (
                           SELECT COUNT(DISTINCT o3.customerId)
                           FROM Orders o3
                           WHERE o3.companyId = :companyId
                             AND (:brandId IS NULL OR o3.brandId = :brandId)
                             AND o3.productId = d.productId
                             AND o3.customerId IS NOT NULL
                             AND o3.ordStatus IN :includedStatuses
                             AND o3.wdate >= :startDateTime
                             AND o3.wdate < :endDateTime
                       )
                   END,
                   0
               ) AS averageOrderValue
        FROM DailySalesStats d
        JOIN Product p ON p.id = d.productId
        WHERE d.companyId = :companyId
          AND (:brandId IS NULL OR d.brandId = :brandId)
          AND d.date BETWEEN :startDate AND :endDate
        GROUP BY d.productId, p.productName, p.skuCd, p.realStock
        ORDER BY totalNetRevenue DESC
        """)
    List<ProductSalesDTO> findSalesByProduct(
        @Param("companyId") Long companyId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate")   LocalDate endDate,
        @Param("startDateTime") java.time.LocalDateTime startDateTime,
        @Param("endDateTime") java.time.LocalDateTime endDateTime,
        @Param("includedStatuses") List<String> includedStatuses,
        @Param("brandId") Long brandId
    );

    // ------------------------------------------------------------------
    // Brand-level GROUP BY
    // ------------------------------------------------------------------
    @Query("""
        SELECT d.brandId                           AS brandId,
               b.brandName                         AS brandName,
               ROUND(COALESCE(SUM(d.grossAmount),    0), 0)  AS totalGrossAmount,
               ROUND(COALESCE(SUM(d.discountAmount), 0), 0)  AS totalDiscountAmount,
               ROUND(COALESCE(SUM(d.netRevenue),     0), 0)  AS totalNetRevenue,
               ROUND(COALESCE(SUM(d.shippingFee),    0), 0)  AS totalShippingFee
        FROM DailySalesStats d
        JOIN Brand b ON b.id = d.brandId
        WHERE d.companyId = :companyId
          AND (:brandId IS NULL OR d.brandId = :brandId)
          AND d.date BETWEEN :startDate AND :endDate
        GROUP BY d.brandId, b.brandName
        ORDER BY totalNetRevenue DESC
        """)
    List<BrandSalesDTO> findSalesByBrand(
        @Param("companyId") Long companyId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate")   LocalDate endDate,
        @Param("brandId") Long brandId
    );

    // ------------------------------------------------------------------
    // Shop-level GROUP BY
    // ------------------------------------------------------------------
    @Query("""
        SELECT d.shopId                            AS shopId,
               s.shopName                          AS shopName,
               s.shopCode                          AS shopCode,
               ROUND(COALESCE(SUM(d.grossAmount),    0), 0)  AS totalGrossAmount,
               ROUND(COALESCE(SUM(d.discountAmount), 0), 0)  AS totalDiscountAmount,
               ROUND(COALESCE(SUM(d.netRevenue),     0), 0)  AS totalNetRevenue,
               ROUND(COALESCE(SUM(d.shippingFee),    0), 0)  AS totalShippingFee
        FROM DailySalesStats d
        JOIN Shop s ON s.id = d.shopId
        WHERE d.companyId = :companyId
          AND (:brandId IS NULL OR d.brandId = :brandId)
          AND d.date BETWEEN :startDate AND :endDate
        GROUP BY d.shopId, s.shopName, s.shopCode
        ORDER BY totalNetRevenue DESC
        """)
    List<ShopSalesDTO> findSalesByShop(
        @Param("companyId") Long companyId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate")   LocalDate endDate,
        @Param("brandId") Long brandId
    );

    // ------------------------------------------------------------------
    // Shop + Brand cross-dimensional GROUP BY
    // ------------------------------------------------------------------
    @Query("""
        SELECT d.shopId                            AS shopId,
               s.shopName                          AS shopName,
               s.shopCode                          AS shopCode,
               d.brandId                            AS brandId,
               b.brandName                         AS brandName,
               ROUND(COALESCE(SUM(d.grossAmount),    0), 0)  AS totalGrossAmount,
               ROUND(COALESCE(SUM(d.discountAmount), 0), 0)  AS totalDiscountAmount,
               ROUND(COALESCE(SUM(d.netRevenue),     0), 0)  AS totalNetRevenue,
               ROUND(COALESCE(SUM(d.shippingFee),    0), 0)  AS totalShippingFee
        FROM DailySalesStats d
        JOIN Shop s ON s.id = d.shopId
        JOIN Brand b ON b.id = d.brandId
        WHERE d.companyId = :companyId
          AND (:brandId IS NULL OR d.brandId = :brandId)
          AND d.date BETWEEN :startDate AND :endDate
        GROUP BY d.shopId, s.shopName, s.shopCode, d.brandId, b.brandName
        ORDER BY totalNetRevenue DESC
        """)
    List<ShopBrandSalesDTO> findSalesByShopBrand(
        @Param("companyId") Long companyId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate")   LocalDate endDate,
        @Param("brandId") Long brandId
    );

    // ------------------------------------------------------------------
    // Trend Analysis (Stacked by Platform) with Granularity
    // ------------------------------------------------------------------
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
        @Param("endDate")   LocalDate endDate,
        @Param("granularity") String granularity,
        @Param("brandId") Long brandId
    );
}
