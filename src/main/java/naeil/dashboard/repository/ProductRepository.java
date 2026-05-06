package naeil.dashboard.repository;

import java.util.List;
import naeil.dashboard.dto.ProductInventoryDTO;
import naeil.dashboard.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findByCompanyIdAndSkuCd(Long companyId, String skuCd);
    Optional<Product> findByCompanyIdAndProdNo(Long companyId, Long prodNo);

    @Query("""
        SELECT p.id        AS productId,
               p.brandId   AS brandId,
               b.brandName AS brandName,
               p.productName AS productName,
               p.skuCd       AS skuCd,
               p.prodNo      AS prodNo,
               p.realStock   AS realStock,
               p.safeStock   AS safeStock,
               p.mdate       AS mdate
        FROM Product p
        JOIN Brand b ON b.id = p.brandId
        WHERE p.companyId = :companyId
          AND (:brandId IS NULL OR p.brandId = :brandId)
        ORDER BY b.brandName ASC, p.productName ASC
        """)
    List<ProductInventoryDTO> findInventoryByCompanyId(
            @Param("companyId") Long companyId,
            @Param("brandId") Long brandId
    );
}
