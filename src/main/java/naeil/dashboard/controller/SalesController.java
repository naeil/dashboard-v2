package naeil.dashboard.controller;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.*;
import naeil.dashboard.service.SalesService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * REST API for sales aggregation.
 *
 * All endpoints require companyId for tenant isolation.
 * Authentication is NOT implemented in this phase — companyId is passed explicitly.
 *
 * Endpoints:
 *   GET /api/sales/summary
 *   GET /api/sales/product
 *   GET /api/sales/brand
 *   GET /api/sales/shop
 *   GET /api/sales/shop-brand
 *
 * Query params: companyId, startDate (yyyy-MM-dd), endDate (yyyy-MM-dd)
 */
@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SalesController {

    private final SalesService salesService;

    // ------------------------------------------------------------------
    // GET /api/sales/summary
    // ------------------------------------------------------------------
    @GetMapping("/summary")
    public ResponseEntity<SalesSummaryDTO> getSummary(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long brandId) {

        return ResponseEntity.ok(salesService.getSummary(companyId, startDate, endDate, brandId));
    }

    // ------------------------------------------------------------------
    // GET /api/sales/product
    // ------------------------------------------------------------------
    @GetMapping("/product")
    public ResponseEntity<List<ProductSalesDTO>> getProductSales(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long brandId) {

        return ResponseEntity.ok(salesService.getProductSales(companyId, startDate, endDate, brandId));
    }

    // ------------------------------------------------------------------
    // GET /api/sales/brand
    // ------------------------------------------------------------------
    @GetMapping("/brand")
    public ResponseEntity<List<BrandSalesDTO>> getBrandSales(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long brandId) {

        return ResponseEntity.ok(salesService.getBrandSales(companyId, startDate, endDate, brandId));
    }

    // ------------------------------------------------------------------
    // GET /api/sales/shop
    // ------------------------------------------------------------------
    @GetMapping("/shop")
    public ResponseEntity<List<ShopSalesDTO>> getShopSales(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long brandId) {

        return ResponseEntity.ok(salesService.getShopSales(companyId, startDate, endDate, brandId));
    }

    // ------------------------------------------------------------------
    // GET /api/sales/shop-brand
    // ------------------------------------------------------------------
    @GetMapping("/shop-brand")
    public ResponseEntity<List<ShopBrandSalesDTO>> getShopBrandSales(
            @RequestParam Long companyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long brandId) {

        return ResponseEntity.ok(salesService.getShopBrandSales(companyId, startDate, endDate, brandId));
    }

    // ------------------------------------------------------------------
    // GET /api/sales/trend
    // ------------------------------------------------------------------
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
}
