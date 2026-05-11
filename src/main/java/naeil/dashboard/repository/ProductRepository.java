package naeil.dashboard.repository;

import java.util.List;
import java.util.Optional;
import naeil.dashboard.dto.ProductCostListItemDTO;
import naeil.dashboard.dto.ProductInventoryDTO;
import naeil.dashboard.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    Optional<Product> findByCompanyIdAndSkuCd(Long companyId, String skuCd);

    Optional<Product> findByCompanyIdAndProdNo(Long companyId, Long prodNo);

    Optional<Product> findByIdAndCompanyId(Long id, Long companyId);

    @Query("""
        SELECT p.id AS productId,
               p.brandId AS brandId,
               b.brandName AS brandName,
               p.productName AS productName,
               p.skuCd AS skuCd,
               p.prodNo AS prodNo,
               p.realStock AS realStock,
               p.safeStock AS safeStock,
               p.mdate AS mdate
        FROM Product p
        JOIN Brand b ON b.id = p.brandId
        WHERE p.companyId = :companyId
          AND p.realStock > 0
          AND b.brandName <> '\uBBF8\uBD84\uB958'
          AND (:brandId IS NULL OR p.brandId = :brandId)
        ORDER BY b.brandName ASC, p.productName ASC
        """)
    List<ProductInventoryDTO> findInventoryByCompanyId(
            @Param("companyId") Long companyId,
            @Param("brandId") Long brandId
    );

    @Query("""
        SELECT p.id AS productId,
               p.brandId AS brandId,
               b.brandName AS brandName,
               p.productName AS productName,
               p.skuCd AS skuCd,
               p.prodNo AS prodNo,
               p.productPrice AS salePrice,
               p.costPrice AS costPrice,
               p.supplyPrice AS supplyPrice,
               COALESCE(profile.sgnaCost, 0) AS sgnaCost,
               COALESCE(profile.logisticsCost, 0) AS logisticsCost,
               COALESCE(profile.packagingCost, 0) AS packagingCost,
               COALESCE(profile.otherCost, 0) AS otherCost,
               p.realStock AS realStock,
               p.safeStock AS safeStock
        FROM Product p
        JOIN Brand b ON b.id = p.brandId
        LEFT JOIN ProductCostProfile profile
               ON profile.companyId = p.companyId
              AND profile.productId = p.id
        WHERE p.companyId = :companyId
          AND b.brandName <> '\uBBF8\uBD84\uB958'
          AND (:brandId IS NULL OR p.brandId = :brandId)
        ORDER BY b.brandName ASC, p.productName ASC
        """)
    List<ProductCostListItemDTO> findCostItemsByCompanyId(
            @Param("companyId") Long companyId,
            @Param("brandId") Long brandId
    );
}
