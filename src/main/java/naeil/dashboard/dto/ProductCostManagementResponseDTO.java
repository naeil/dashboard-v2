package naeil.dashboard.dto;

import java.util.List;

public record ProductCostManagementResponseDTO(
        List<ShopOptionDTO> shops,
        List<ProductCostViewDTO> products
) {
}
