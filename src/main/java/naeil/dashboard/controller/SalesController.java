package naeil.dashboard.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.BrandOptionDTO;
import naeil.dashboard.dto.BrandSalesDTO;
import naeil.dashboard.dto.PlatformTrendSalesDTO;
import naeil.dashboard.dto.ProductMarketSalesDTO;
import naeil.dashboard.dto.ProductSalesDTO;
import naeil.dashboard.dto.SalesSummaryDTO;
import naeil.dashboard.dto.ShopBrandSalesDTO;
import naeil.dashboard.dto.ShopSalesDTO;
import naeil.dashboard.service.PlayAutoCollectionService;
import naeil.dashboard.service.SalesService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SalesController {

    private final SalesService salesService;
    private final PlayAutoCollectionService playAutoCollectionService;

    @GetMapping("/summary")
    public ResponseEntity<SalesSummaryDTO> getSummary(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long brandId) {

        return ResponseEntity.ok(salesService.getSummary(companyId, startDate, endDate, brandId));
    }

    @GetMapping("/product")
    public ResponseEntity<List<ProductSalesDTO>> getProductSales(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long brandId) {

        return ResponseEntity.ok(salesService.getProductSales(companyId, startDate, endDate, brandId));
    }

    @GetMapping("/product/{productId}/channels")
    public ResponseEntity<List<ProductMarketSalesDTO>> getProductMarketSales(
            @PathVariable Long productId,
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        return ResponseEntity.ok(salesService.getProductMarketSales(companyId, productId, startDate, endDate));
    }

    @GetMapping("/brand")
    public ResponseEntity<List<BrandSalesDTO>> getBrandSales(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long brandId) {

        return ResponseEntity.ok(salesService.getBrandSales(companyId, startDate, endDate, brandId));
    }

    @GetMapping("/shop")
    public ResponseEntity<List<ShopSalesDTO>> getShopSales(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long brandId) {

        return ResponseEntity.ok(salesService.getShopSales(companyId, startDate, endDate, brandId));
    }

    @GetMapping("/shop-brand")
    public ResponseEntity<List<ShopBrandSalesDTO>> getShopBrandSales(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long brandId) {

        return ResponseEntity.ok(salesService.getShopBrandSales(companyId, startDate, endDate, brandId));
    }

    @GetMapping("/trend")
    public ResponseEntity<List<PlatformTrendSalesDTO>> getTrend(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "DAY") String granularity,
            @RequestParam(required = false) Long brandId) {

        return ResponseEntity.ok(salesService.getPlatformTrend(companyId, startDate, endDate, granularity, brandId));
    }

    @GetMapping("/brands")
    public ResponseEntity<List<BrandOptionDTO>> getBrands(
            @RequestParam Long companyId) {

        return ResponseEntity.ok(salesService.getBrandOptions(companyId));
    }

    @PostMapping("/refresh-today")
    public ResponseEntity<Map<String, String>> refreshTodayOrders(
            @RequestParam Long companyId) {

        playAutoCollectionService.refreshTodayOrders(companyId);
        return ResponseEntity.ok(Map.of("message", "오늘 주문 재수집이 완료되었습니다."));
    }
}
