package naeil.dashboard.service;

import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.ProductInventoryDTO;
import naeil.dashboard.dto.ProductInventoryViewDTO;
import naeil.dashboard.repository.ProductOutboundRepository;
import naeil.dashboard.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductOutboundRepository productOutboundRepository;

    public List<ProductInventoryViewDTO> getProductInventory(Long companyId, Long brandId, YearMonth targetMonth) {
        List<ProductInventoryDTO> inventoryItems = productRepository.findInventoryByCompanyId(companyId, brandId);
        Map<Long, Integer> outboundByProduct = productOutboundRepository.sumMonthlyOutboundByCompany(
                        companyId,
                        targetMonth.toString()
                ).stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> (Long) row[0],
                        row -> ((Number) row[1]).intValue()
                ));

        return inventoryItems.stream()
                .map(item -> new ProductInventoryViewDTO(
                        item.getProductId(),
                        item.getBrandId(),
                        item.getBrandName(),
                        item.getProductName(),
                        item.getSkuCd(),
                        item.getProdNo(),
                        item.getRealStock(),
                        item.getSafeStock(),
                        outboundByProduct.getOrDefault(item.getProductId(), 0),
                        item.getMdate()
                ))
                .toList();
    }
}
