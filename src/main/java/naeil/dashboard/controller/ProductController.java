package naeil.dashboard.controller;

import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.ProductChannelCostUpdateRequest;
import naeil.dashboard.dto.ProductChannelCostViewDTO;
import naeil.dashboard.dto.ProductCostManagementResponseDTO;
import naeil.dashboard.dto.ProductCostProfileUpdateRequest;
import naeil.dashboard.dto.ProductCostViewDTO;
import naeil.dashboard.dto.ProductInventoryViewDTO;
import naeil.dashboard.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping("/inventory")
    public ResponseEntity<List<ProductInventoryViewDTO>> getInventory(
            @RequestParam Long companyId,
            @RequestParam(required = false) Long brandId,
            @RequestParam(required = false) String targetMonth
    ) {
        YearMonth month = (targetMonth == null || targetMonth.isBlank())
                ? YearMonth.now()
                : YearMonth.parse(targetMonth);

        return ResponseEntity.ok(productService.getProductInventory(companyId, brandId, month));
    }

    @GetMapping("/costs")
    public ResponseEntity<ProductCostManagementResponseDTO> getProductCosts(
            @RequestParam Long companyId,
            @RequestParam(required = false) Long brandId
    ) {
        return ResponseEntity.ok(productService.getProductCosts(companyId, brandId));
    }

    @PutMapping("/{productId}/costs")
    public ResponseEntity<ProductCostViewDTO> updateProductCosts(
            @PathVariable Long productId,
            @RequestParam Long companyId,
            @RequestBody ProductCostProfileUpdateRequest request
    ) {
        return ResponseEntity.ok(productService.updateProductCosts(companyId, productId, request));
    }

    @PutMapping("/{productId}/channel-costs/{shopId}")
    public ResponseEntity<ProductChannelCostViewDTO> updateProductChannelCost(
            @PathVariable Long productId,
            @PathVariable Long shopId,
            @RequestParam Long companyId,
            @RequestBody ProductChannelCostUpdateRequest request
    ) {
        return ResponseEntity.ok(productService.updateProductChannelCost(companyId, productId, shopId, request));
    }
}
