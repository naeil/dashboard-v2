package naeil.dashboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.common.api.PlayAutoApiClient;
import naeil.dashboard.common.order.OrderStatusGroups;
import naeil.dashboard.dto.PlayAutoShopResponseDTO;
import naeil.dashboard.dto.PlayAutoStockInoutResponseDTO;
import naeil.dashboard.dto.PlayAutoStockResponseDTO;
import naeil.dashboard.entity.Brand;
import naeil.dashboard.entity.Customer;
import naeil.dashboard.entity.DailySalesStats;
import naeil.dashboard.entity.Orders;
import naeil.dashboard.entity.Product;
import naeil.dashboard.entity.ProductOutbound;
import naeil.dashboard.entity.Shop;
import naeil.dashboard.enums.IntegrationType;
import naeil.dashboard.repository.BrandRepository;
import naeil.dashboard.repository.CustomerRepository;
import naeil.dashboard.repository.DailySalesStatsRepository;
import naeil.dashboard.repository.OrdersRepository;
import naeil.dashboard.repository.ProductRepository;
import naeil.dashboard.repository.ProductOutboundRepository;
import naeil.dashboard.repository.ShopRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlayAutoSyncService {

    private static final DateTimeFormatter DATETIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String DEFAULT_SHOP_CODE = "A000";
    private static final String DEFAULT_SHOP_NAME = "\uC9C1\uC811\uC785\uB825";
    private static final String DEFAULT_BRAND_NAME = "\uBBF8\uBD84\uB958";
    private static final IntegrationType DEFAULT_PLATFORM = IntegrationType.OTHER;

    private final PlayAutoApiClient playAutoApiClient;
    private final IntegrationSettingService integrationSettingService;
    private final ShopRepository shopRepository;
    private final BrandRepository brandRepository;
    private final ProductRepository productRepository;
    private final ProductOutboundRepository productOutboundRepository;
    private final OrdersRepository ordersRepository;
    private final CustomerRepository customerRepository;
    private final DailySalesStatsRepository statsRepository;

    @Transactional
    public void syncShops(Long companyId) {
        IntegrationSettingService.PlayAutoCredentials credentials = integrationSettingService.getValidPlayAutoCredentials(companyId);
        syncShops(companyId, credentials.accessToken(), credentials.apiKey());
    }

    @Transactional
    public void syncShops(Long companyId, String token, String apiKey) {
        log.info("Starting PlayAuto Shop Sync for company: {}", companyId);
        ensureDefaultShop(companyId);
        PlayAutoShopResponseDTO[] shopDtos = playAutoApiClient.getShopInfo(token, apiKey);

        if (shopDtos != null && shopDtos.length > 0) {
            Set<String> existingCodes = shopRepository.findAll().stream()
                    .filter(shop -> companyId.equals(shop.getCompanyId()))
                    .map(Shop::getShopCode)
                    .collect(Collectors.toSet());

            Arrays.stream(shopDtos)
                    .collect(Collectors.toMap(
                            PlayAutoShopResponseDTO::getShopId,
                            dto -> dto,
                            (first, second) -> first
                    ))
                    .values()
                    .forEach(dto -> {
                        Shop shop = shopRepository.findByCompanyIdAndShopCode(companyId, dto.getShopId())
                                .orElseGet(() -> {
                                    if (existingCodes.contains(dto.getShopId())) {
                                        return null;
                                    }
                                    return Shop.builder()
                                            .companyId(companyId)
                                            .shopCode(dto.getShopId())
                                            .build();
                                });

                        if (shop == null) {
                            return;
                        }

                        shop.setShopName(dto.getShopName());
                        shop.setPlatform(resolvePlatform(dto));
                        shopRepository.save(shop);
                    });
            log.info("Successfully synced {} shops.", shopDtos.length);
        }
    }

    @Transactional
    public void syncProducts(Long companyId) {
        IntegrationSettingService.PlayAutoCredentials credentials = integrationSettingService.getValidPlayAutoCredentials(companyId);
        IntegrationSettingService.CollectionWindow window = integrationSettingService.getPlayAutoCollectionWindow(companyId);
        syncProducts(
                companyId,
                credentials.accessToken(),
                credentials.apiKey(),
                window.startDate().format(DateTimeFormatter.ISO_DATE),
                window.endDate().format(DateTimeFormatter.ISO_DATE)
        );
    }

    @Transactional
    public void syncProducts(Long companyId, String token, String apiKey) {
        IntegrationSettingService.CollectionWindow window = integrationSettingService.getPlayAutoCollectionWindow(companyId);
        syncProducts(
                companyId,
                token,
                apiKey,
                window.startDate().format(DateTimeFormatter.ISO_DATE),
                window.endDate().format(DateTimeFormatter.ISO_DATE)
        );
    }

    @Transactional
    public void syncProducts(Long companyId, String token, String apiKey, String sDate, String eDate) {
        log.info("Starting PlayAuto Product/Stock Sync for company: {} [{} ~ {}]", companyId, sDate, eDate);
        PlayAutoStockResponseDTO stockData = playAutoApiClient.getStockList(token, apiKey, sDate, eDate);

        if (stockData != null && stockData.getResults() != null) {
            int syncedCount = 0;
            int skippedMissingIdentityCount = 0;

            for (PlayAutoStockResponseDTO.StockItem item : stockData.getResults()) {
                int realStock = sumRealStock(item);
                int safeStock = sumSafeStock(item);
                if (isBlank(item.getSkuCd()) || item.getProdNo() == null) {
                    skippedMissingIdentityCount++;
                    continue;
                }

                Brand brand = resolveBrand(companyId, item.getBrand());
                Product product = productRepository.findByCompanyIdAndProdNo(companyId, item.getProdNo())
                        .orElse(productRepository.findByCompanyIdAndSkuCd(companyId, item.getSkuCd())
                                .orElse(Product.builder()
                                        .companyId(companyId)
                                        .brandId(brand.getId())
                                        .build()));

                product.setBrandId(brand.getId());
                product.setProductName(item.getProdName());
                product.setSkuCd(item.getSkuCd());
                product.setProdNo(item.getProdNo());
                product.setRealStock(realStock);
                product.setSafeStock(safeStock);
                product.setWdate(parseDateTime(item.getWdate()));
                product.setMdate(parseDateTime(item.getMdate()));

                productRepository.save(product);
                syncedCount++;
            }
            log.info(
                    "Successfully synced {} products. skippedMissingIdentity={}",
                    syncedCount,
                    skippedMissingIdentityCount
            );
        }
    }

    @Transactional
    public void syncOrders(Long companyId, String sDate, String eDate) {
        IntegrationSettingService.PlayAutoCredentials credentials = integrationSettingService.getValidPlayAutoCredentials(companyId);
        syncOrders(companyId, credentials.accessToken(), credentials.apiKey(), sDate, eDate);
    }

    @Transactional
    public void syncOrders(Long companyId, String token, String apiKey, String sDate, String eDate) {
        log.info("Starting PlayAuto Order Sync for company: {} [{} ~ {}]", companyId, sDate, eDate);
        JsonNode orderData = playAutoApiClient.getOrderList(token, apiKey, sDate, eDate);
        Map<String, Customer> customerCache = new HashMap<>();
        Map<String, JsonNode> productSnapshotByUniq = buildOrderProductSnapshotMap(orderData);
        JsonNode orderResults = orderData != null ? orderData.path("results") : null;

        if (orderResults != null && orderResults.isArray()) {
            int skippedMissingSkuCount = 0;
            for (JsonNode node : orderResults) {
                boolean processed = processSingleOrder(
                        companyId,
                        node,
                        productSnapshotByUniq.get(node.path("uniq").asText()),
                        customerCache
                );
                if (!processed) {
                    skippedMissingSkuCount++;
                }
            }
            log.info(
                    "Successfully processed {} order nodes. recordsTotal={}, skippedMissingSku={}",
                    orderResults.size() - skippedMissingSkuCount,
                    orderData.path("recordsTotal").asInt(orderResults.size())
                    ,
                    skippedMissingSkuCount
            );
        } else {
            log.warn("PlayAuto order response does not contain results array for company {}", companyId);
        }
    }

    @Transactional
    public void syncProductOutbound(Long companyId, LocalDate targetDate) {
        IntegrationSettingService.PlayAutoCredentials credentials = integrationSettingService.getValidPlayAutoCredentials(companyId);
        syncProductOutbound(companyId, credentials.accessToken(), credentials.apiKey(), targetDate);
    }

    @Transactional
    public void syncProductOutbound(Long companyId, String token, String apiKey, LocalDate targetDate) {
        String dateText = targetDate.format(DateTimeFormatter.ISO_DATE);
        log.info("Starting PlayAuto Product Outbound Sync for company: {} [{}]", companyId, dateText);

        PlayAutoStockInoutResponseDTO response = playAutoApiClient.getStockInout(token, apiKey, dateText, dateText);
        Map<Long, Integer> outboundByProductId = new HashMap<>();

        if (response != null && response.getResults() != null) {
            for (PlayAutoStockInoutResponseDTO.StockInoutItem item : response.getResults()) {
                // PlayAuto returns outbound quantities as negative numbers for outbound rows.
                int outCount = normalizeOutboundCount(item);
                if (outCount <= 0) {
                    continue;
                }

                Optional<Product> productOpt = resolveProduct(companyId, item.getProdNo(), item.getSkuCd());
                if (productOpt.isEmpty()) {
                    continue;
                }

                outboundByProductId.merge(productOpt.get().getId(), outCount, Integer::sum);
            }
        }

        for (Map.Entry<Long, Integer> entry : outboundByProductId.entrySet()) {
            Product product = productRepository.findById(entry.getKey()).orElse(null);
            if (product == null) {
                continue;
            }

            ProductOutbound outbound = productOutboundRepository
                    .findByCompanyIdAndProductIdAndOutboundDate(companyId, product.getId(), targetDate)
                    .orElse(ProductOutbound.builder()
                            .companyId(companyId)
                            .productId(product.getId())
                            .brandId(product.getBrandId())
                            .outboundDate(targetDate)
                            .build());

            outbound.setBrandId(product.getBrandId());
            outbound.setOutboundCount(entry.getValue());
            outbound.setCollectedAt(LocalDateTime.now());
            productOutboundRepository.save(outbound);
        }

        log.info("Completed PlayAuto Product Outbound Sync for company: {} [{}], saved {} product rows.", companyId, dateText, outboundByProductId.size());
    }

    private int normalizeOutboundCount(PlayAutoStockInoutResponseDTO.StockInoutItem item) {
        if (item == null || item.getOutCnt() == null) {
            return 0;
        }

        return Math.abs(item.getOutCnt());
    }

    @Transactional(readOnly = true)
    public LocalDate getLastProductOutboundDate(Long companyId) {
        return productOutboundRepository.findLastCollectedOutboundDate(companyId);
    }

    @Transactional
    public void remapOrdersToResolvedProducts(Long companyId) {
        Brand defaultBrand = ensureDefaultBrand(companyId);
        List<Orders> orders = ordersRepository.findAllByCompanyId(companyId);

        for (Orders order : orders) {
            if (isBlank(order.getSkuCd())) {
                continue;
            }

            Optional<Product> resolvedProduct = productRepository.findByCompanyIdAndSkuCd(companyId, order.getSkuCd());
            if (resolvedProduct.isEmpty()) {
                continue;
            }

            Product product = resolvedProduct.get();
            boolean needsUpdate = !product.getId().equals(order.getProductId())
                    || !product.getBrandId().equals(order.getBrandId())
                    || defaultBrand.getId().equals(order.getBrandId());

            if (!needsUpdate) {
                continue;
            }

            order.setProductId(product.getId());
            order.setBrandId(product.getBrandId());
            ordersRepository.save(order);
        }
    }

    @Transactional
    public void rebuildDailySalesStats(Long companyId) {
        dailySalesStatsRebuild(companyId, ordersRepository.findAllByCompanyId(companyId));
    }

    private boolean processSingleOrder(
            Long companyId,
            JsonNode node,
            JsonNode productSnapshot,
            Map<String, Customer> customerCache
    ) {
        String uniq = node.path("uniq").asText();
        String oriUniq = textOrNull(node.path("ori_uniq"));
        String status = node.path("ord_status").asText();
        String resolvedSkuCd = resolveOrderSkuCd(node, productSnapshot);

        Optional<Orders> existingOpt = ordersRepository.findByUniq(uniq);

        // API???띯뫁???대??????????獄쏆뮇源?????덉쨮??uniq 揶쎛 獄쏆뮄???랁??봔筌?雅뚯눖揆甕곕뜇?뉐첎? ori_uniq ????용┛??野껋럩??
        // 疫꿸퀣??雅뚯눖揆???곕뗄???뤿연 ??????띯뫁???? ?怨밴묶????낅쑓??꾨뱜??????덈즲嚥???몃빍??
        if (existingOpt.isEmpty() && !isBlank(oriUniq)) {
            existingOpt = ordersRepository.findByUniq(oriUniq);
        }

        if (isBlank(resolvedSkuCd) && existingOpt.isEmpty()) {
            return false;
        }

        if (existingOpt.isEmpty()) {
            Orders order = saveNewOrder(companyId, node, productSnapshot, resolvedSkuCd, customerCache);
            if (OrderStatusGroups.isRevenueIncludedStatus(status)) {
                updateStats(companyId, order, false);
            } else if (OrderStatusGroups.isCompletedReversalStatus(status)) {
                // DB????용뮉 ?醫됲뇣 雅뚯눖揆????? '?띯뫁??袁⑥┷' ?怨밴묶嚥???쇰선??野껋럩??(??녿┛?????띯뫁???
                // 筌띲끉??+), 雅뚯눖揆?癒?땾(+)???믪눘? 疫꿸퀡以?????띯뫁??-), ?띯뫁??癒?땾(+)??疫꿸퀡以??곷튊 ???롥첎? 筌띿쉸???덈뼄.
                updateStats(companyId, order, false);
                BigDecimal cancelAmt = parseBigDecimal(node.path("pay_amt"));
                order.markAsReversed(status, cancelAmt);
                ordersRepository.save(order);
                updateStats(companyId, order, true);
            }
            return true;
        }

        if (OrderStatusGroups.isCompletedReversalStatus(status) && existingOpt.isPresent()) {
            Orders order = existingOpt.get();
            if (!OrderStatusGroups.isCompletedReversalStatus(order.getOrdStatus())) {
                BigDecimal cancelAmt = parseBigDecimal(node.path("pay_amt"));
                // ?띯뫁?????문 ?紐껊굡??野껋럩??pay_amt揶쎛 0??곗쨮 ?????삳뮉 野껋럩??첎? 筌띾‘?앲첋?嚥? ??野껋럩??疫꿸퀣????雅뚯눖揆??野껉퀣?ｆ묾?됰만???????몃빍??
                if (cancelAmt.compareTo(BigDecimal.ZERO) <= 0) {
                    cancelAmt = null; 
                }
                order.markAsReversed(status, cancelAmt);
                ordersRepository.save(order);
                updateStats(companyId, order, true);
            }
        }
        return true;
    }

    private Orders saveNewOrder(
            Long companyId,
            JsonNode node,
            JsonNode productSnapshot,
            String resolvedSkuCd,
            Map<String, Customer> customerCache
    ) {
        BigDecimal payAmt = parseBigDecimal(node.path("pay_amt"));
        BigDecimal discountAmt = resolveDiscountAmount(node);
        BigDecimal grossAmt = payAmt.add(discountAmt);
        BigDecimal shippingFee = parseBigDecimal(node.path("ship_cost"));
        String skuCd = resolvedSkuCd;
        Long prodNo = parseLong(firstNonBlank(
                textOrNull(productSnapshot != null ? productSnapshot.path("prod_no") : null),
                textOrNull(node.path("prod_no"))
        ));
        String shopCode = firstNonBlank(textOrNull(node.path("shop_cd")), DEFAULT_SHOP_CODE);
        String shopName = firstNonBlank(textOrNull(node.path("shop_name")), DEFAULT_SHOP_NAME);
        Customer customer = resolveCustomer(companyId, node, customerCache);

        Shop shop = resolveShop(companyId, shopCode, shopName);
        Product product = resolveOrCreateProduct(companyId, prodNo, skuCd, node, productSnapshot);
        Long internalProductId = product.getId();
        Long brandId = product.getBrandId();
        LocalDateTime wdate = LocalDateTime.parse(node.path("wdate").asText(), DATETIME_FORMATTER);

        JsonNode payTimeNode = node.path("pay_time");
        LocalDateTime payTime = (payTimeNode.isMissingNode() || payTimeNode.asText().isEmpty())
                ? null
                : LocalDateTime.parse(payTimeNode.asText(), DATETIME_FORMATTER);

        Orders order = Orders.builder()
                .uniq(node.path("uniq").asText())
                .companyId(companyId)
                .brandId(brandId)
                .shopId(shop.getId())
                .productId(internalProductId)
                .customerId(customer != null ? customer.getId() : null)
                .skuCd(skuCd)
                .grossAmt(grossAmt)
                .discountAmt(discountAmt)
                .shippingFee(shippingFee)
                .payAmt(payAmt)
                .ordStatus(node.path("ord_status").asText())
                .wdate(wdate)
                .payTime(payTime)
                .build();

        return ordersRepository.save(order);
    }

    private Customer resolveCustomer(Long companyId, JsonNode node, Map<String, Customer> customerCache) {
        String cleanPhone = cleanPhone(firstNonBlank(
                node.path("order_htel").asText(null),
                node.path("order_tel").asText(null),
                node.path("recv_htel").asText(null),
                node.path("recv_tel").asText(null)
        ));

        if (!isValidPhone(cleanPhone)) {
            return null;
        }

        return customerCache.computeIfAbsent(cleanPhone, phone -> {
            Customer customer = customerRepository.findByCompanyIdAndCustomerHtel(companyId, phone)
                    .orElseGet(() -> Customer.builder()
                            .companyId(companyId)
                            .customerName(firstNonBlank(
                                    node.path("order_name").asText(null),
                                    node.path("recv_name").asText(null)
                            ))
                            .customerEmail(blankToNull(node.path("order_email").asText(null)))
                            .customerHtel(phone)
                            .customerHtelHash(hashPhone(phone))
                            .totalOrderCount(0)
                            .build());

            if (isBlank(customer.getCustomerName())) {
                customer.setCustomerName(firstNonBlank(
                        node.path("order_name").asText(null),
                        node.path("recv_name").asText(null)
                ));
            }
            if (isBlank(customer.getCustomerEmail())) {
                customer.setCustomerEmail(blankToNull(node.path("order_email").asText(null)));
            }

            customer.incrementOrderCount();
            return customerRepository.save(customer);
        });
    }

    private BigDecimal parseBigDecimal(JsonNode node) {
        if (node.isMissingNode() || node.isNull()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(node.asText("0")).setScale(0, RoundingMode.HALF_UP);
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }

    private LocalDateTime parseDateTime(String value) {
        if (isBlank(value) || "0000-00-00".equals(value) || "0000-00-00 00:00:00".equals(value)) {
            return null;
        }
        try {
            return LocalDateTime.parse(value, DATETIME_FORMATTER);
        } catch (Exception e) {
            return null;
        }
    }

    private Brand resolveBrand(Long companyId, String brandName) {
        String normalizedBrandName = normalizeBrandName(brandName);
        return brandRepository.findByCompanyIdAndBrandName(companyId, normalizedBrandName)
                .orElseGet(() -> brandRepository.save(
                        Brand.builder()
                                .companyId(companyId)
                                .brandName(normalizedBrandName)
                                .build()
                ));
    }

    private Brand ensureDefaultBrand(Long companyId) {
        return resolveBrand(companyId, DEFAULT_BRAND_NAME);
    }

    private Shop resolveShop(Long companyId, String shopCode, String shopName) {
        return shopRepository.findByCompanyIdAndShopCode(companyId, shopCode)
                .orElseGet(() -> shopRepository.save(
                        Shop.builder()
                                .companyId(companyId)
                                .shopCode(shopCode)
                                .shopName(shopName)
                                .platform(IntegrationType.fromShop(shopName, shopCode))
                                .build()
                ));
    }

    private Optional<Product> resolveProduct(Long companyId, Long prodNo, String skuCd) {
        if (prodNo != null) {
            Optional<Product> byProdNo = productRepository.findByCompanyIdAndProdNo(companyId, prodNo);
            if (byProdNo.isPresent()) {
                return byProdNo;
            }
        }

        if (!isBlank(skuCd)) {
            return productRepository.findByCompanyIdAndSkuCd(companyId, skuCd);
        }

        return Optional.empty();
    }

    private Product resolveOrCreateProduct(
            Long companyId,
            Long prodNo,
            String skuCd,
            JsonNode orderNode,
            JsonNode productSnapshot
    ) {
        Optional<Product> existing = resolveProduct(companyId, prodNo, skuCd);
        if (existing.isPresent()) {
            return existing.get();
        }

        Brand brand = ensureDefaultBrand(companyId);
        String productName = firstNonBlank(
                textOrNull(productSnapshot != null ? productSnapshot.path("prod_name") : null),
                textOrNull(orderNode.path("shop_sale_name")),
                "沃섎챶?뉒몴??怨밸?"
        );

        return productRepository.save(Product.builder()
                .companyId(companyId)
                .brandId(brand.getId())
                .productName(productName)
                .skuCd(blankToNull(skuCd))
                .prodNo(prodNo)
                .build());
    }

    private Map<String, JsonNode> buildOrderProductSnapshotMap(JsonNode orderData) {
        Map<String, JsonNode> productSnapshotByUniq = new HashMap<>();
        if (orderData == null) {
            return productSnapshotByUniq;
        }

        JsonNode resultsProd = orderData.path("results_prod");
        if (!resultsProd.isArray()) {
            return productSnapshotByUniq;
        }

        Map<String, List<JsonNode>> groupedByUniq = new HashMap<>();
        for (JsonNode item : resultsProd) {
            String uniq = item.path("uniq").asText();
            if (isBlank(uniq)) {
                continue;
            }
            groupedByUniq.computeIfAbsent(uniq, key -> new ArrayList<>()).add(item);
        }

        for (Map.Entry<String, List<JsonNode>> entry : groupedByUniq.entrySet()) {
            productSnapshotByUniq.put(entry.getKey(), choosePreferredProductSnapshot(entry.getValue()));
        }

        return productSnapshotByUniq;
    }

    private JsonNode choosePreferredProductSnapshot(List<JsonNode> productSnapshots) {
        for (JsonNode item : productSnapshots) {
            if (!isBlank(textOrNull(item.path("sku_cd")))) {
                return item;
            }
        }
        return productSnapshots.get(0);
    }

    private BigDecimal resolveDiscountAmount(JsonNode node) {
        BigDecimal discountAmount = parseBigDecimal(node.path("discount_amt"));
        if (discountAmount.compareTo(BigDecimal.ZERO) > 0) {
            return discountAmount;
        }

        return parseBigDecimal(node.path("coupon_discount"))
                .add(parseBigDecimal(node.path("point_discount")))
                .add(parseBigDecimal(node.path("shop_discount")))
                .add(parseBigDecimal(node.path("seller_discount")));
    }

    private String resolveOrderSkuCd(JsonNode node, JsonNode productSnapshot) {
        return firstNonBlank(
                textOrNull(node.path("sku_cd")),
                textOrNull(node.path("shop_sku_cd")),
                textOrNull(productSnapshot != null ? productSnapshot.path("sku_cd") : null)
        );
    }

    private int sumRealStock(PlayAutoStockResponseDTO.StockItem item) {
        if (item.getDepots() == null || item.getDepots().isEmpty()) {
            return 0;
        }

        return item.getDepots().stream()
                .map(PlayAutoStockResponseDTO.Depot::getRealStock)
                .filter(value -> value != null)
                .mapToInt(Integer::intValue)
                .sum();
    }

    private int sumSafeStock(PlayAutoStockResponseDTO.StockItem item) {
        if (item.getDepots() == null || item.getDepots().isEmpty()) {
            return 0;
        }

        return item.getDepots().stream()
                .map(PlayAutoStockResponseDTO.Depot::getSafeStock)
                .filter(value -> value != null)
                .mapToInt(Integer::intValue)
                .sum();
    }

    private void updateStats(Long companyId, Orders order, boolean isCancellation) {
        LocalDate targetDate = order.getWdate().toLocalDate();

        DailySalesStats stats = statsRepository.findByCompanyIdAndDateAndShopIdAndBrandIdAndProductId(
                companyId, targetDate, order.getShopId(), order.getBrandId(), order.getProductId())
                .orElse(DailySalesStats.builder()
                        .companyId(companyId)
                        .date(targetDate)
                        .shopId(order.getShopId())
                        .brandId(order.getBrandId())
                        .productId(order.getProductId())
                        .grossAmount(BigDecimal.ZERO)
                        .discountAmount(BigDecimal.ZERO)
                        .netRevenue(BigDecimal.ZERO)
                        .shippingFee(BigDecimal.ZERO)
                        .cancelAmount(BigDecimal.ZERO)
                        .ordererCount(0)
                        .cancelCount(0)
                        .build());

        if (!isCancellation) {
            stats.setGrossAmount(stats.getGrossAmount().add(order.getGrossAmt()));
            stats.setDiscountAmount(stats.getDiscountAmount().add(order.getDiscountAmt()));
            stats.setNetRevenue(stats.getNetRevenue().add(order.getPayAmt()));
            stats.setShippingFee(stats.getShippingFee().add(order.getShippingFee()));
            stats.setOrdererCount(stats.getOrdererCount() + 1);
        } else {
            stats.setGrossAmount(stats.getGrossAmount().subtract(order.getGrossAmt()));
            stats.setDiscountAmount(stats.getDiscountAmount().subtract(order.getDiscountAmt()));
            stats.setNetRevenue(stats.getNetRevenue().subtract(order.getPayAmt()));
            stats.setCancelAmount(stats.getCancelAmount().add(order.getPayAmt()));
            stats.setOrdererCount(Math.max(0, stats.getOrdererCount() - 1));
            stats.setCancelCount(stats.getCancelCount() + 1);
        }

        statsRepository.save(stats);
    }

    private void dailySalesStatsRebuild(Long companyId, List<Orders> orders) {
        statsRepository.deleteByCompanyId(companyId);
        statsRepository.flush();

        Map<String, DailySalesStats> statsMap = new HashMap<>();
        for (Orders order : orders) {
            if (order.getWdate() == null || order.getProductId() == null || order.getBrandId() == null || order.getShopId() == null) {
                continue;
            }

            LocalDate targetDate = order.getWdate().toLocalDate();
            String key = companyId + "|" + targetDate + "|" + order.getShopId() + "|" + order.getBrandId() + "|" + order.getProductId();
            DailySalesStats stats = statsMap.computeIfAbsent(key, unused -> DailySalesStats.builder()
                    .companyId(companyId)
                    .date(targetDate)
                    .shopId(order.getShopId())
                    .brandId(order.getBrandId())
                    .productId(order.getProductId())
                    .grossAmount(BigDecimal.ZERO)
                    .discountAmount(BigDecimal.ZERO)
                    .netRevenue(BigDecimal.ZERO)
                    .shippingFee(BigDecimal.ZERO)
                    .cancelAmount(BigDecimal.ZERO)
                    .ordererCount(0)
                    .cancelCount(0)
                    .build());

            if (OrderStatusGroups.isCompletedReversalStatus(order.getOrdStatus())) {
                stats.setGrossAmount(stats.getGrossAmount().subtract(order.getGrossAmt()));
                stats.setDiscountAmount(stats.getDiscountAmount().subtract(order.getDiscountAmt()));
                stats.setNetRevenue(stats.getNetRevenue().subtract(order.getPayAmt()));
                stats.setCancelAmount(stats.getCancelAmount().add(
                        order.getCancelAmt() != null && order.getCancelAmt().compareTo(BigDecimal.ZERO) > 0
                                ? order.getCancelAmt()
                                : order.getPayAmt()
                ));
                stats.setOrdererCount(Math.max(0, stats.getOrdererCount() - 1));
                stats.setCancelCount(stats.getCancelCount() + 1);
            } else if (OrderStatusGroups.isRevenueIncludedStatus(order.getOrdStatus())) {
                stats.setGrossAmount(stats.getGrossAmount().add(order.getGrossAmt()));
                stats.setDiscountAmount(stats.getDiscountAmount().add(order.getDiscountAmt()));
                stats.setNetRevenue(stats.getNetRevenue().add(order.getPayAmt()));
                stats.setShippingFee(stats.getShippingFee().add(order.getShippingFee()));
                stats.setOrdererCount(stats.getOrdererCount() + 1);
            }
        }

        if (!statsMap.isEmpty()) {
            statsRepository.saveAll(statsMap.values());
        }
    }

    private String cleanPhone(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().replaceAll("\\D", "");
    }

    private boolean isValidPhone(String phone) {
        return phone != null && phone.length() >= 10 && !phone.endsWith("0000");
    }

    private String hashPhone(String phone) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(phone.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to hash customer phone", e);
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private String blankToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String value = node.asText();
        return isBlank(value) ? null : value.trim();
    }

    private Long parseLong(String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String normalizeBrandName(String brandName) {
        return isBlank(brandName) ? DEFAULT_BRAND_NAME : brandName.trim();
    }

    private Shop ensureDefaultShop(Long companyId) {
        return shopRepository.findByCompanyIdAndShopCode(companyId, DEFAULT_SHOP_CODE)
                .orElseGet(() -> shopRepository.save(
                        Shop.builder()
                                .companyId(companyId)
                                .shopCode(DEFAULT_SHOP_CODE)
                                .shopName(DEFAULT_SHOP_NAME)
                                .platform(DEFAULT_PLATFORM)
                                .build()
                ));
    }

    private IntegrationType resolvePlatform(PlayAutoShopResponseDTO dto) {
        return IntegrationType.fromShop(dto.getShopName(), dto.getShopId());
    }
}



