package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.BrandOptionDTO;
import naeil.dashboard.dto.BrandSalesDTO;
import naeil.dashboard.dto.PlatformTrendSalesDTO;
import naeil.dashboard.dto.ProductMarketSalesDTO;
import naeil.dashboard.dto.ProductSalesDTO;
import naeil.dashboard.dto.SalesSummaryAggregateDTO;
import naeil.dashboard.dto.SalesSummaryDTO;
import naeil.dashboard.dto.ShopBrandSalesDTO;
import naeil.dashboard.dto.ShopSalesDTO;
import naeil.dashboard.repository.BrandRepository;
import naeil.dashboard.repository.DailySalesStatsRepository;
import naeil.dashboard.repository.OrdersRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import naeil.dashboard.common.order.OrderStatusGroups;
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SalesService {

    private static final String UNCLASSIFIED_BRAND_NAME = "\uBBF8\uBD84\uB958";

    private final DailySalesStatsRepository salesRepository;
    private final OrdersRepository ordersRepository;
    private final BrandRepository brandRepository;

    public SalesSummaryDTO getSummary(Long companyId, LocalDate startDate, LocalDate endDate, Long brandId) {
        SalesSummaryAggregateDTO summary = salesRepository.findSummary(companyId, startDate, endDate, brandId);
        Long totalCustomerCount = ordersRepository.countDistinctCustomersInPeriod(
                companyId,
                brandId,
                startDate.atStartOfDay(),
                endDate.plusDays(1).atStartOfDay(),
                OrderStatusGroups.REVENUE_INCLUDED_STATUSES
        );

        return new SalesSummaryDTO(
                summary.getTotalGrossAmount(),
                summary.getTotalDiscountAmount(),
                summary.getTotalNetRevenue(),
                summary.getTotalShippingFee(),
                summary.getTotalCancelAmount(),
                summary.getCancelCount(),
                summary.getTotalOrderCount(),
                totalCustomerCount == null ? 0L : totalCustomerCount,
                summary.getProfitAmount()
        );
    }

    public List<ProductSalesDTO> getProductSales(Long companyId, LocalDate startDate, LocalDate endDate, Long brandId) {
        return salesRepository.findSalesByProduct(
                companyId,
                startDate,
                endDate,
                brandId
        );
    }

    public List<BrandSalesDTO> getBrandSales(Long companyId, LocalDate startDate, LocalDate endDate, Long brandId) {
        return salesRepository.findSalesByBrand(companyId, startDate, endDate, brandId);
    }

    public List<ProductMarketSalesDTO> getProductMarketSales(
            Long companyId,
            Long productId,
            LocalDate startDate,
            LocalDate endDate
    ) {
        return salesRepository.findSalesByProductAndShop(companyId, productId, startDate, endDate);
    }

    public List<ShopSalesDTO> getShopSales(Long companyId, LocalDate startDate, LocalDate endDate, Long brandId) {
        return salesRepository.findSalesByShop(companyId, startDate, endDate, brandId);
    }

    public List<ShopBrandSalesDTO> getShopBrandSales(Long companyId, LocalDate startDate, LocalDate endDate, Long brandId) {
        return salesRepository.findSalesByShopBrand(companyId, startDate, endDate, brandId);
    }

    public List<PlatformTrendSalesDTO> getPlatformTrend(
            Long companyId,
            LocalDate startDate,
            LocalDate endDate,
            String granularity,
            Long brandId
    ) {
        String pgGranularity = switch (granularity.toUpperCase()) {
            case "WEEK" -> "week";
            case "MONTH" -> "month";
            default -> "day";
        };
        return salesRepository.findTrendByPlatform(companyId, startDate, endDate, pgGranularity, brandId);
    }

    public List<BrandOptionDTO> getBrandOptions(Long companyId) {
        return brandRepository.findAllByCompanyIdOrderByBrandNameAsc(companyId).stream()
                .filter(brand -> brand.getBrandName() != null)
                .filter(brand -> !UNCLASSIFIED_BRAND_NAME.equals(brand.getBrandName().trim()))
                .map(brand -> new BrandOptionDTO(brand.getId(), brand.getBrandName()))
                .toList();
    }
}
