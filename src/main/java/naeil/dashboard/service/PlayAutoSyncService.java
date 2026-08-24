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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import naeil.dashboard.common.api.PlayAutoApiClient;
import naeil.dashboard.common.order.OrderStatusGroups;
import naeil.dashboard.dto.PlayAutoStockConditionResponseDTO;
import naeil.dashboard.dto.PlayAutoShopResponseDTO;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlayAutoSyncService {

    private static final DateTimeFormatter DATETIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_DATE;
    private static final int ORDER_SYNC_CHUNK_DAYS = 7;
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
            Map<String, PlayAutoShopResponseDTO> uniqueShopsByCode = new HashMap<>();
            for (PlayAutoShopResponseDTO dto : shopDtos) {
                String shopCode = blankToNull(dto.getShopCode());
                if (isBlank(shopCode) || isBlank(dto.getShopName())) {
                    continue;
                }
                uniqueShopsByCode.put(shopCode, dto);
            }

            int syncedCount = 0;
            for (PlayAutoShopResponseDTO dto : uniqueShopsByCode.values()) {
                String shopCode = blankToNull(dto.getShopCode());
                if (shopCode == null) {
                    continue;
                }

                Shop shop = shopRepository.findByCompanyIdAndShopCode(companyId, shopCode)
                        .orElseGet(() -> Shop.builder()
                                .companyId(companyId)
                                .shopCode(shopCode)
                                .build());

                shop.setShopCode(shopCode);
                shop.setShopName(dto.getShopName());
                shop.setPlatform(resolvePlatform(dto));
                shopRepository.save(shop);
                syncedCount++;
            }
            log.info("Successfully synced {} shops.", syncedCount);
        }
    }

    @Transactional
    public void syncProducts(Long companyId) {
        IntegrationSettingService.PlayAutoCredentials credentials = integrationSettingService.getValidPlayAutoCredentials(companyId);
        syncProducts(companyId, credentials.accessToken(), credentials.apiKey());
    }

    @Transactional
    public void syncProducts(Long companyId, String token, String apiKey) {
        log.info("Starting PlayAuto Product/Stock Sync for company: {} [fetchMode=FULL_PRODUCT_LIST]", companyId);
        PlayAutoStockConditionResponseDTO stockData = playAutoApiClient.getStockConditionList(token, apiKey);

        if (stockData != null && stockData.getResults() != null) {
            int syncedCount = 0;
            int skippedMissingIdentityCount = 0;
            int skippedNewOutOfStockCount = 0;
            int skippedNewUnclassifiedBrandCount = 0;
            int zeroStockUpdatedCount = 0;

            LocalDate collectionDate = LocalDate.now();
            for (StockConditionAggregate item : aggregateStockConditionItems(stockData.getResults())) {
                if (isBlank(item.skuCd()) || item.prodNo() == null) {
                    skippedMissingIdentityCount++;
                    continue;
                }

                Product existingProduct = productRepository.findByCompanyIdAndProdNo(companyId, item.prodNo())
                        .orElse(productRepository.findByCompanyIdAndSkuCd(companyId, item.skuCd()).orElse(null));

                if (existingProduct == null) {
                    if (item.realStock() <= 0) {
                        skippedNewOutOfStockCount++;
                        continue;
                    }

                    if (isUnclassifiedBrandName(item.brand())) {
                        skippedNewUnclassifiedBrandCount++;
                        continue;
                    }

                    Brand brand = resolveBrand(companyId, item.brand());
                    Product newProduct = Product.builder()
                            .companyId(companyId)
                            .brandId(brand.getId())
                            .build();

                    newProduct.setProductName(item.prodName());
                    newProduct.setSkuCd(item.skuCd());
                    newProduct.setProdNo(item.prodNo());
                    newProduct.setProductPrice(normalizeMoney(item.salePrice()));
                    newProduct.setCostPrice(normalizeMoney(item.costPrice()));
                    newProduct.setSupplyPrice(normalizeMoney(item.supplyPrice()));
                    newProduct.setRealStock(item.realStock());
                    newProduct.setSafeStock(item.safeStock());
                    newProduct.setWdate(item.wdate());
                    newProduct.setMdate(item.mdate());

                    Product savedProduct = productRepository.save(newProduct);
                    syncProductOutboundSnapshot(companyId, savedProduct, item.outCntAccum(), collectionDate);
                    syncedCount++;
                    continue;
                }

                if (!isUnclassifiedBrandName(item.brand())) {
                    Brand brand = resolveBrand(companyId, item.brand());
                    existingProduct.setBrandId(brand.getId());
                }

                existingProduct.setProductName(item.prodName());
                existingProduct.setSkuCd(item.skuCd());
                existingProduct.setProdNo(item.prodNo());
                existingProduct.setProductPrice(normalizeMoney(item.salePrice()));
                existingProduct.setCostPrice(normalizeMoney(item.costPrice()));
                existingProduct.setSupplyPrice(normalizeMoney(item.supplyPrice()));
                existingProduct.setRealStock(item.realStock());
                existingProduct.setSafeStock(item.safeStock());
                existingProduct.setWdate(item.wdate());
                existingProduct.setMdate(item.mdate());

                Product savedProduct = productRepository.save(existingProduct);
                syncProductOutboundSnapshot(companyId, savedProduct, item.outCntAccum(), collectionDate);
                if (item.realStock() <= 0) {
                    zeroStockUpdatedCount++;
                } else {
                    syncedCount++;
                }
            }
            log.info(
                    "Successfully synced {} products. skippedMissingIdentity={}, skippedNewOutOfStock={}, skippedNewUnclassifiedBrand={}, zeroStockUpdated={}",
                    syncedCount,
                    skippedMissingIdentityCount,
                    skippedNewOutOfStockCount,
                    skippedNewUnclassifiedBrandCount,
                    zeroStockUpdatedCount
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
        LocalDate startDate = parseIsoDate(sDate);
        LocalDate endDate = parseIsoDate(eDate);
        if (startDate != null && endDate != null) {
            List<DateRange> chunks = splitDateRanges(startDate, endDate, ORDER_SYNC_CHUNK_DAYS);
            if (chunks.size() > 1) {
                log.info(
                        "Starting PlayAuto Order Sync chunk processing for company {}. totalChunks={} [{} ~ {}]",
                        companyId,
                        chunks.size(),
                        sDate,
                        eDate
                );
                for (int index = 0; index < chunks.size(); index++) {
                    DateRange chunk = chunks.get(index);
                    int chunkNumber = index + 1;
                    log.info(
                            "Starting PlayAuto Order Sync chunk {}/{} for company {} [{} ~ {}]",
                            chunkNumber,
                            chunks.size(),
                            companyId,
                            chunk.startDate(),
                            chunk.endDate()
                    );
                    syncOrdersRange(
                            companyId,
                            token,
                            apiKey,
                            chunk.startDate().format(DATE_FORMATTER),
                            chunk.endDate().format(DATE_FORMATTER)
                    );
                    log.info(
                            "Completed PlayAuto Order Sync chunk {}/{} for company {} [{} ~ {}]",
                            chunkNumber,
                            chunks.size(),
                            companyId,
                            chunk.startDate(),
                            chunk.endDate()
                    );
                }
                return;
            }
        }

        syncOrdersRange(companyId, token, apiKey, sDate, eDate);
    }

    private void syncOrdersRange(Long companyId, String token, String apiKey, String sDate, String eDate) {
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

    private List<DateRange> splitDateRanges(LocalDate startDate, LocalDate endDate, int chunkDays) {
        List<DateRange> ranges = new ArrayList<>();
        for (LocalDate current = startDate; !current.isAfter(endDate); current = current.plusDays(chunkDays)) {
            LocalDate chunkEnd = current.plusDays(chunkDays - 1L);
            if (chunkEnd.isAfter(endDate)) {
                chunkEnd = endDate;
            }
            ranges.add(new DateRange(current, chunkEnd));
        }
        return ranges;
    }

    private LocalDate parseIsoDate(String value) {
        if (isBlank(value)) {
            return null;
        }

        try {
            return LocalDate.parse(value, DATE_FORMATTER);
        } catch (Exception e) {
            return null;
        }
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
        String status = node.path("ord_status").asText();
        String resolvedSkuCd = resolveEffectiveOrderSkuCd(node, productSnapshot);

        Optional<Orders> existingOpt = ordersRepository.findByUniq(uniq);

        // API???띯뫁???대??????????獄쏆뮇源?????덉쨮??uniq 揶쎛 獄쏆뮄???랁??봔筌?雅뚯눖揆甕곕뜇?뉐첎? ori_uniq ????용┛??野껋럩??
        // 疫꿸퀣??雅뚯눖揆???곕뗄???뤿연 ??????띯뫁???? ?怨밴묶????낅쑓??꾨뱜??????덈즲嚥???몃빍??
        if (existingOpt.isEmpty()) {
            OrderSaveOutcome outcome = saveNewOrder(companyId, node, productSnapshot, resolvedSkuCd, customerCache);
            if (!outcome.created()) {
                log.info("Skipping duplicate order during sync. uniq={}", uniq);
                return true;
            }

            Orders order = outcome.order();
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

        if (existingOpt.isPresent()) {
            Orders order = refreshExistingOrder(companyId, existingOpt.get(), node, productSnapshot, resolvedSkuCd);
            if (OrderStatusGroups.isCompletedReversalStatus(status)) {
                BigDecimal cancelAmt = parseBigDecimal(node.path("pay_amt"));
                // ?띯뫁?????문 ?紐껊굡??野껋럩??pay_amt揶쎛 0??곗쨮 ?????삳뮉 野껋럩??첎? 筌띾‘?앲첋?嚥? ??野껋럩??疫꿸퀣????雅뚯눖揆??野껉퀣?ｆ묾?됰만???????몃빍??
                if (cancelAmt.compareTo(BigDecimal.ZERO) <= 0) {
                    cancelAmt = null; 
                }
                order.markAsReversed(status, cancelAmt);
                ordersRepository.save(order);
                updateStats(companyId, order, true);
            } else {
                order.clearCancelAmt();
                ordersRepository.save(order);
            }
        }
        return true;
    }

    private OrderSaveOutcome saveNewOrder(
            Long companyId,
            JsonNode node,
            JsonNode productSnapshot,
            String resolvedSkuCd,
            Map<String, Customer> customerCache
    ) {
        BigDecimal payAmt = parseBigDecimal(node.path("pay_amt"));
        BigDecimal discountAmt = resolveDiscountAmount(node);
        BigDecimal shippingFee = parseBigDecimal(node.path("ship_cost"));
        BigDecimal grossAmt = calculateGrossAmount(payAmt, discountAmt, shippingFee);
        Integer orderQuantity = resolveOrderQuantity(node, productSnapshot);
        String skuCd = resolvedSkuCd;
        Long prodNo = parseLong(firstNonBlank(
                textOrNull(productSnapshot != null ? productSnapshot.path("prod_no") : null),
                textOrNull(node.path("prod_no"))
        ));
        String shopCode = firstNonBlank(
                textOrNull(node.path("shop_cd")),
                textOrNull(node.path("pa_shop_cd")),
                DEFAULT_SHOP_CODE
        );
        String shopName = firstNonBlank(textOrNull(node.path("shop_name")), DEFAULT_SHOP_NAME);
        Customer customer = resolveCustomer(companyId, node, customerCache);

        Shop shop = resolveShop(companyId, shopCode, shopName);
        Product product = resolveOrCreateProduct(companyId, prodNo, skuCd, node, productSnapshot);
        Long internalProductId = product.getId();
        Long brandId = product.getBrandId();
        LocalDateTime ordTime = parseDateTime(node.path("ord_time").asText());
        LocalDateTime wdate = LocalDateTime.parse(node.path("wdate").asText(), DATETIME_FORMATTER);

        JsonNode payTimeNode = node.path("pay_time");
        LocalDateTime payTime = (payTimeNode.isMissingNode() || payTimeNode.asText().isEmpty())
                ? null
                : LocalDateTime.parse(payTimeNode.asText(), DATETIME_FORMATTER);
        String uniq = node.path("uniq").asText();

        Orders order = Orders.builder()
                .uniq(uniq)
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
                .orderQuantity(orderQuantity)
                .ordStatus(node.path("ord_status").asText())
                .ordTime(ordTime)
                .wdate(wdate)
                .payTime(payTime)
                .build();

        try {
            return new OrderSaveOutcome(ordersRepository.save(order), true);
        } catch (DataIntegrityViolationException e) {
            Orders existingOrder = ordersRepository.findByUniq(uniq).orElse(null);
            if (existingOrder != null) {
                log.warn("Duplicate order detected during save. Reusing existing order. uniq={}", uniq);
                return new OrderSaveOutcome(existingOrder, false);
            }
            throw e;
        }
    }

    private Orders refreshExistingOrder(
            Long companyId,
            Orders order,
            JsonNode node,
            JsonNode productSnapshot,
            String resolvedSkuCd
    ) {
        BigDecimal payAmt = parseBigDecimal(node.path("pay_amt"));
        BigDecimal discountAmt = resolveDiscountAmount(node);
        BigDecimal shippingFee = parseBigDecimal(node.path("ship_cost"));
        BigDecimal grossAmt = calculateGrossAmount(payAmt, discountAmt, shippingFee);
        Integer orderQuantity = resolveOrderQuantity(node, productSnapshot);
        Long prodNo = parseLong(firstNonBlank(
                textOrNull(productSnapshot != null ? productSnapshot.path("prod_no") : null),
                textOrNull(node.path("prod_no"))
        ));
        String shopCode = firstNonBlank(
                textOrNull(node.path("shop_cd")),
                textOrNull(node.path("pa_shop_cd")),
                DEFAULT_SHOP_CODE
        );
        String shopName = firstNonBlank(textOrNull(node.path("shop_name")), DEFAULT_SHOP_NAME);

        Shop shop = resolveShop(companyId, shopCode, shopName);
        Product product = resolveOrCreateProduct(companyId, prodNo, resolvedSkuCd, node, productSnapshot);
        LocalDateTime ordTime = parseDateTime(node.path("ord_time").asText());
        LocalDateTime wdate = parseDateTime(node.path("wdate").asText());
        LocalDateTime payTime = parseDateTime(node.path("pay_time").asText());

        order.refreshFromSync(
                product.getBrandId(),
                shop.getId(),
                product.getId(),
                resolvedSkuCd,
                grossAmt,
                discountAmt,
                shippingFee,
                payAmt,
                orderQuantity,
                ordTime,
                payTime,
                wdate,
                node.path("ord_status").asText()
        );
        return order;
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
            try {
                return customerRepository.save(customer);
            } catch (DataIntegrityViolationException e) {
                Customer existingCustomer = customerRepository.findByCompanyIdAndCustomerHtel(companyId, phone)
                        .orElse(null);
                if (existingCustomer == null) {
                    throw e;
                }

                if (isBlank(existingCustomer.getCustomerName())) {
                    existingCustomer.setCustomerName(firstNonBlank(
                            node.path("order_name").asText(null),
                            node.path("recv_name").asText(null)
                    ));
                }
                if (isBlank(existingCustomer.getCustomerEmail())) {
                    existingCustomer.setCustomerEmail(blankToNull(node.path("order_email").asText(null)));
                }
                existingCustomer.incrementOrderCount();
                log.warn("Duplicate customer detected during save. Reusing existing customer. companyId={}, phone={}", companyId, phone);
                return customerRepository.save(existingCustomer);
            }
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

    /**
     * 채널 직연동(네이버/쿠팡 등) 주문 상세를 orders 테이블에 적재한다.
     * PlayAuto와 동일한 상점/상품/브랜드 매핑을 재사용하므로 판매 분석 페이지에 그대로 반영된다.
     */
    @Transactional
    public void upsertDirectOrder(
            Long companyId,
            String uniq,
            String shopCode,
            String shopName,
            String productName,
            String skuCd,
            Integer quantity,
            BigDecimal payAmt,
            LocalDateTime payTime,
            String ordStatus
    ) {
        String safeSku = isBlank(skuCd) ? uniq : skuCd;
        Shop shop = resolveShop(companyId, shopCode, shopName);
        Product product = resolveProduct(companyId, null, safeSku).orElseGet(() -> {
            Brand brand = ensureDefaultBrand(companyId);
            return productRepository.save(Product.builder()
                    .companyId(companyId)
                    .brandId(brand.getId())
                    .productName(isBlank(productName) ? "직연동 상품" : productName)
                    .skuCd(blankToNull(safeSku))
                    .build());
        });
        Orders existing = ordersRepository.findByUniq(uniq).orElse(null);
        if (existing != null) {
            existing.refreshFromSync(product.getBrandId(), shop.getId(), product.getId(), safeSku,
                    payAmt, BigDecimal.ZERO, BigDecimal.ZERO, payAmt, quantity,
                    payTime, payTime, payTime, ordStatus);
            ordersRepository.save(existing);
            return;
        }
        Orders order = Orders.builder()
                .uniq(uniq)
                .companyId(companyId)
                .brandId(product.getBrandId())
                .shopId(shop.getId())
                .productId(product.getId())
                .skuCd(safeSku)
                .grossAmt(payAmt)
                .discountAmt(BigDecimal.ZERO)
                .shippingFee(BigDecimal.ZERO)
                .payAmt(payAmt)
                .orderQuantity(quantity)
                .ordStatus(ordStatus)
                .ordTime(payTime)
                .wdate(payTime)
                .payTime(payTime)
                .build();
        try {
            ordersRepository.save(order);
        } catch (DataIntegrityViolationException e) {
            log.warn("[DirectOrder] duplicate uniq={} — skip", uniq);
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

    private String resolveEffectiveOrderSkuCd(JsonNode node, JsonNode productSnapshot) {
        return firstNonBlank(
                resolveOrderSkuCd(node, productSnapshot),
                buildSyntheticSkuCd(node, productSnapshot)
        );
    }

    private String buildSyntheticSkuCd(JsonNode node, JsonNode productSnapshot) {
        String shopCode = firstNonBlank(
                textOrNull(node.path("shop_cd")),
                textOrNull(node.path("pa_shop_cd")),
                DEFAULT_SHOP_CODE
        );
        String identitySource = firstNonBlank(
                textOrNull(productSnapshot != null ? productSnapshot.path("prod_name") : null),
                textOrNull(node.path("shop_sale_name")),
                textOrNull(node.path("shop_opt_name")),
                textOrNull(node.path("shop_add_opt_name")),
                textOrNull(node.path("model_no")),
                textOrNull(node.path("uniq"))
        );
        return "AUTO-" + shopCode + "-" + hashText(shopCode + "|" + identitySource).substring(0, 12);
    }

    private List<StockConditionAggregate> aggregateStockConditionItems(
            List<PlayAutoStockConditionResponseDTO.StockConditionItem> items
    ) {
        Map<String, MutableStockConditionAggregate> aggregated = new LinkedHashMap<>();
        for (PlayAutoStockConditionResponseDTO.StockConditionItem item : items) {
            String key = item.getProdNo() != null ? "PROD:" + item.getProdNo() : "SKU:" + blankToNull(item.getSkuCd());
            if (key.endsWith("null")) {
                continue;
            }

            MutableStockConditionAggregate aggregate = aggregated.computeIfAbsent(
                    key,
                    unused -> new MutableStockConditionAggregate(item.getProdNo(), blankToNull(item.getSkuCd()))
            );
            aggregate.merge(item, this::parseDateTime);
        }

        return aggregated.values().stream()
                .map(MutableStockConditionAggregate::toImmutable)
                .toList();
    }

    private void syncProductOutboundSnapshot(
            Long companyId,
            Product product,
            int currentAccum,
            LocalDate collectionDate
    ) {
        ProductOutbound today = productOutboundRepository
                .findByCompanyIdAndProductIdAndOutboundDate(companyId, product.getId(), collectionDate)
                .orElse(ProductOutbound.builder()
                        .companyId(companyId)
                        .productId(product.getId())
                        .brandId(product.getBrandId())
                        .outboundDate(collectionDate)
                        .outboundCount(0)
                        .outboundAccumSnapshot(0)
                        .build());

        Integer previousAccum = productOutboundRepository
                .findTopByCompanyIdAndProductIdAndOutboundDateBeforeOrderByOutboundDateDesc(
                        companyId,
                        product.getId(),
                        collectionDate
                )
                .map(ProductOutbound::getOutboundAccumSnapshot)
                .orElse(null);

        int outboundCount = previousAccum == null ? 0 : Math.max(0, currentAccum - previousAccum);

        today.setBrandId(product.getBrandId());
        today.setOutboundCount(outboundCount);
        today.setOutboundAccumSnapshot(currentAccum);
        today.setCollectedAt(LocalDateTime.now());
        productOutboundRepository.save(today);
    }

    private void updateStats(Long companyId, Orders order, boolean isCancellation) {
        LocalDateTime salesBaseDateTime = resolveSalesBaseDateTime(order);
        if (salesBaseDateTime == null) {
            return;
        }
        LocalDate targetDate = salesBaseDateTime.toLocalDate();

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
            stats.setGrossAmount(stats.getGrossAmount().add(resolveGrossAmount(order)));
            stats.setDiscountAmount(stats.getDiscountAmount().add(order.getDiscountAmt()));
            stats.setNetRevenue(stats.getNetRevenue().add(resolveNetRevenue(order)));
            stats.setShippingFee(stats.getShippingFee().add(order.getShippingFee()));
            stats.setOrdererCount(stats.getOrdererCount() + 1);
        } else {
            stats.setGrossAmount(stats.getGrossAmount().subtract(resolveGrossAmount(order)));
            stats.setDiscountAmount(stats.getDiscountAmount().subtract(order.getDiscountAmt()));
            stats.setNetRevenue(stats.getNetRevenue().subtract(resolveNetRevenue(order)));
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
            LocalDateTime salesBaseDateTime = resolveSalesBaseDateTime(order);
            if (salesBaseDateTime == null || order.getProductId() == null || order.getBrandId() == null || order.getShopId() == null) {
                continue;
            }

            LocalDate targetDate = salesBaseDateTime.toLocalDate();
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
                /*
                 * The orders table stores the latest state for each order.
                 * During a full stats rebuild, a cancelled/returned order should therefore
                 * contribute cancellation metrics only instead of recreating a negative sale.
                 * Otherwise partial backfills or status-only syncs can produce negative bars.
                 */
                stats.setShippingFee(stats.getShippingFee().add(order.getShippingFee()));
                stats.setCancelAmount(stats.getCancelAmount().add(
                        order.getCancelAmt() != null && order.getCancelAmt().compareTo(BigDecimal.ZERO) > 0
                                ? order.getCancelAmt()
                                : order.getPayAmt()
                ));
                stats.setCancelCount(stats.getCancelCount() + 1);
            } else if (OrderStatusGroups.isRevenueIncludedStatus(order.getOrdStatus())) {
                stats.setGrossAmount(stats.getGrossAmount().add(resolveGrossAmount(order)));
                stats.setDiscountAmount(stats.getDiscountAmount().add(order.getDiscountAmt()));
                stats.setNetRevenue(stats.getNetRevenue().add(resolveNetRevenue(order)));
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
        return hashText(phone);
    }

    private String hashText(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(String.valueOf(value).getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to hash value", e);
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
            return Long.parseLong(value.replace(",", "").trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Integer parseInteger(String value) {
        Long parsed = parseLong(value);
        if (parsed == null || parsed <= 0) {
            return null;
        }
        return parsed > Integer.MAX_VALUE ? Integer.MAX_VALUE : parsed.intValue();
    }

    private Integer resolveOrderQuantity(JsonNode node, JsonNode productSnapshot) {
        Integer quantity = parseInteger(firstNonBlank(
                textOrNull(node.path("order_quantity")),
                textOrNull(node.path("order_qty")),
                textOrNull(node.path("ord_qty")),
                textOrNull(node.path("prod_qty")),
                textOrNull(node.path("prod_cnt")),
                textOrNull(node.path("goods_cnt")),
                textOrNull(node.path("item_qty")),
                textOrNull(node.path("qty")),
                textOrNull(node.path("cnt")),
                textOrNull(productSnapshot != null ? productSnapshot.path("order_quantity") : null),
                textOrNull(productSnapshot != null ? productSnapshot.path("order_qty") : null),
                textOrNull(productSnapshot != null ? productSnapshot.path("ord_qty") : null),
                textOrNull(productSnapshot != null ? productSnapshot.path("prod_qty") : null),
                textOrNull(productSnapshot != null ? productSnapshot.path("prod_cnt") : null),
                textOrNull(productSnapshot != null ? productSnapshot.path("goods_cnt") : null),
                textOrNull(productSnapshot != null ? productSnapshot.path("item_qty") : null),
                textOrNull(productSnapshot != null ? productSnapshot.path("qty") : null),
                textOrNull(productSnapshot != null ? productSnapshot.path("cnt") : null)
        ));
        return quantity != null ? quantity : 1;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String normalizeBrandName(String brandName) {
        return isBlank(brandName) ? DEFAULT_BRAND_NAME : brandName.trim();
    }

    private boolean isUnclassifiedBrandName(String brandName) {
        return DEFAULT_BRAND_NAME.equals(normalizeBrandName(brandName));
    }

    private LocalDateTime resolveSalesBaseDateTime(Orders order) {
        if (order == null) {
            return null;
        }
        return order.getOrdTime() != null ? order.getOrdTime() : order.getWdate();
    }

    private BigDecimal resolveGrossAmount(Orders order) {
        if (order == null) {
            return BigDecimal.ZERO;
        }
        return calculateGrossAmount(order.getPayAmt(), order.getDiscountAmt(), order.getShippingFee());
    }

    private BigDecimal resolveNetRevenue(Orders order) {
        if (order == null) {
            return BigDecimal.ZERO;
        }
        // pay_amt는 PlayAuto의 실결제금액(쿠폰·포인트·할인 이미 반영)이므로 그대로 사용.
        // discount_amt를 한 번 더 빼면 이중 차감이 되어 매출이 실제보다 낮아짐.
        return order.getPayAmt() != null ? order.getPayAmt() : BigDecimal.ZERO;
    }

    private BigDecimal calculateGrossAmount(BigDecimal payAmt, BigDecimal discountAmt, BigDecimal shippingFee) {
        BigDecimal safePayAmt = payAmt != null ? payAmt : BigDecimal.ZERO;
        BigDecimal safeDiscountAmt = discountAmt != null ? discountAmt : BigDecimal.ZERO;
        BigDecimal safeShippingFee = shippingFee != null ? shippingFee : BigDecimal.ZERO;
        // grossAmt = 할인 전 원가 복원(pay_amt + discount_amt) + 배송비
        // pay_amt는 이미 할인 반영된 실결제금액이므로 discount_amt를 더해야 원가 복원됨
        return safePayAmt.add(safeDiscountAmt).add(safeShippingFee);
    }

    private BigDecimal normalizeMoney(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.max(BigDecimal.ZERO);
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
        return IntegrationType.fromShop(dto.getShopName(), blankToNull(dto.getShopCode()));
    }

    private LocalDateTime maxDateTime(LocalDateTime left, LocalDateTime right) {
        if (left == null) {
            return right;
        }
        if (right == null) {
            return left;
        }
        return left.isAfter(right) ? left : right;
    }

    private final class MutableStockConditionAggregate {
        private final Long prodNo;
        private final String skuCd;
        private String prodName;
        private String brand;
        private BigDecimal salePrice;
        private BigDecimal costPrice;
        private BigDecimal supplyPrice;
        private int realStock;
        private int safeStock;
        private int outCntAccum;
        private LocalDateTime wdate;
        private LocalDateTime mdate;

        private MutableStockConditionAggregate(Long prodNo, String skuCd) {
            this.prodNo = prodNo;
            this.skuCd = skuCd;
        }

        private void merge(
                PlayAutoStockConditionResponseDTO.StockConditionItem item,
                java.util.function.Function<String, LocalDateTime> dateParser
        ) {
            this.prodName = firstNonBlank(this.prodName, item.getProdName());
            this.brand = firstNonBlank(this.brand, item.getBrand());
            this.salePrice = this.salePrice != null ? this.salePrice : item.getSalePrice();
            this.costPrice = this.costPrice != null ? this.costPrice : item.getCostPrice();
            this.supplyPrice = this.supplyPrice != null ? this.supplyPrice : item.getSupplyPrice();
            this.realStock += item.getStockCntReal() != null ? item.getStockCntReal() : 0;
            this.safeStock += item.getStockCntSafe() != null ? item.getStockCntSafe() : 0;
            this.outCntAccum += item.getOutCntAccum() != null ? item.getOutCntAccum() : 0;
            this.wdate = maxDateTime(this.wdate, dateParser.apply(item.getWdate()));
            this.mdate = maxDateTime(this.mdate, dateParser.apply(item.getMdate()));
        }

        private StockConditionAggregate toImmutable() {
            return new StockConditionAggregate(
                    prodNo,
                    skuCd,
                    prodName,
                    brand,
                    salePrice,
                    costPrice,
                    supplyPrice,
                    realStock,
                    safeStock,
                    outCntAccum,
                    wdate,
                    mdate
            );
        }
    }

    private record DateRange(LocalDate startDate, LocalDate endDate) {
    }

    private record OrderSaveOutcome(Orders order, boolean created) {
    }

    private record StockConditionAggregate(
            Long prodNo,
            String skuCd,
            String prodName,
            String brand,
            BigDecimal salePrice,
            BigDecimal costPrice,
            BigDecimal supplyPrice,
            int realStock,
            int safeStock,
            int outCntAccum,
            LocalDateTime wdate,
            LocalDateTime mdate
    ) {
    }
}



