package naeil.dashboard.controller;

import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.ProductInventoryViewDTO;
import naeil.dashboard.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
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
            @RequestParam(required = false) String targetMonth) {

        YearMonth month = (targetMonth == null || targetMonth.isBlank())
                ? YearMonth.now()
                : YearMonth.parse(targetMonth);

        return ResponseEntity.ok(productService.getProductInventory(companyId, brandId, month));
    }
}
