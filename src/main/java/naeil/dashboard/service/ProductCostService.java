package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 제품 원가 관리 서비스
 * - product_sku_master / logistics_fee_config / product_cost_channel CRUD
 * - 엑셀 업로드 파싱 (260601_상품원가_*.xlsx 형식)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductCostService {

    private final JdbcTemplate jdbcTemplate;

    // ──────────────────────────────────────────────────────────────
    // 채널 수수료율 기본값 (헤더에서 파싱 안될 때 fallback)
    // ──────────────────────────────────────────────────────────────
    private static final Map<String, Double> DEFAULT_CHANNEL_FEE = Map.of(
            "스마트스토어팜", 0.06,
            "쿠팡",          0.11,
            "자사몰",         0.05,
            "11번가",        0.13,
            "지마켓",         0.10,
            "옥션",           0.10,
            "카카오톡스토어", 0.08,
            "해외(국가별)",   0.00,
            "오프라인(납품처별)", 0.00
    );
    private static final List<String> CHANNEL_SHEET_NAMES = List.of(
            "스마트스토어팜", "자사몰", "11번가", "지마켓", "옥션", "쿠팡", "카카오톡스토어",
            "해외(국가별)", "오프라인(납품처별)"
    );

    // ──────────────────────────────────────────────────────────────
    // 엑셀 업로드
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> uploadExcel(Long companyId, MultipartFile file) throws Exception {
        Map<String, Object> result = new LinkedHashMap<>();
        int skuCount = 0;
        int channelCount = 0;

        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            // 1. 물류비 시트 → product_sku_master + 이름→SKU 매핑 추출
            Sheet skuSheet = wb.getSheet("물류비");
            Map<String, String> nameToSku = new HashMap<>(); // 제품명 → sku_code
            if (skuSheet != null) {
                skuCount = parseSkuSheet(companyId, skuSheet);
                nameToSku = buildNameToSkuMap(skuSheet);
            }

            // 2. 채널별 시트 → product_cost_channel (sku 자동 매핑 포함)
            for (String channelName : CHANNEL_SHEET_NAMES) {
                Sheet sheet = wb.getSheet(channelName);
                if (sheet == null) continue;
                int cnt = parseChannelSheet(companyId, channelName, sheet, nameToSku);
                channelCount += cnt;
                result.put(channelName, cnt + "개 처리");
            }
        }

        result.put("skuMaster", skuCount + "개 처리");
        result.put("totalChannelRows", channelCount);
        result.put("message", "엑셀 업로드 완료");
        return result;
    }

    /** 물류비 시트 파싱 → product_sku_master upsert */
    private int parseSkuSheet(Long companyId, Sheet sheet) {
        // 헤더 찾기: "플레이오토 sku코드" 가 있는 행
        int headerRow = -1;
        int colSku = -1, colName = -1, colTempType = -1, colWeightG = -1, colCost = -1;

        for (int r = 0; r <= Math.min(sheet.getLastRowNum(), 10); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            boolean hasSkuHeader = false;
            for (int c = 0; c < row.getLastCellNum(); c++) {
                String cellStr = cellString(row.getCell(c)).toLowerCase();
                if (cellStr.contains("sku코드") || cellStr.contains("sku 코드")) {
                    hasSkuHeader = true;
                    headerRow = r;
                    colSku = c;
                }
            }
            if (hasSkuHeader) {
                for (int c = 0; c < row.getLastCellNum(); c++) {
                    String cellStr = cellString(row.getCell(c)).toLowerCase();
                    if (cellStr.contains("상품규격") || cellStr.contains("제품명") || cellStr.contains("상품명")) colName = c;
                    if (cellStr.contains("상온") || cellStr.contains("냉동")) colTempType = c;
                    if (cellStr.equals("g") || cellStr.contains("무게")) colWeightG = c;
                    if (cellStr.contains("생산원가")) colCost = c;
                }
            }
            if (headerRow >= 0) break;
        }

        if (headerRow < 0 || colSku < 0) {
            log.warn("물류비 시트 헤더를 찾지 못했습니다.");
            return 0;
        }

        int count = 0;
        for (int r = headerRow + 1; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            String skuCode = cellString(row.getCell(colSku)).trim();
            if (skuCode.isEmpty()) continue;

            String productName = colName >= 0 ? cellString(row.getCell(colName)) : "";
            String tempType    = colTempType >= 0 ? cellString(row.getCell(colTempType)) : "상온";
            if (tempType.isEmpty()) tempType = "상온";
            int weightG        = colWeightG >= 0 ? (int) cellDouble(row.getCell(colWeightG)) : 0;
            BigDecimal cost    = colCost >= 0 ? BigDecimal.valueOf(cellDouble(row.getCell(colCost))) : BigDecimal.ZERO;

            jdbcTemplate.update("""
                INSERT INTO product_sku_master
                    (company_id, sku_code, product_name, weight_g, temp_type, production_cost)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (company_id, sku_code) DO UPDATE SET
                    product_name    = EXCLUDED.product_name,
                    weight_g        = EXCLUDED.weight_g,
                    temp_type       = EXCLUDED.temp_type,
                    production_cost = EXCLUDED.production_cost,
                    updated_at      = NOW()
                """,
                companyId, skuCode, productName, weightG, tempType, cost);
            count++;
        }
        return count;
    }

    /**
     * 물류비 시트 → "제품명 소문자 → SKU코드" 맵 빌드 (채널 시트 sku_code 자동 매핑용)
     */
    private Map<String, String> buildNameToSkuMap(Sheet sheet) {
        Map<String, String> map = new HashMap<>();
        int headerRow = -1, colSku = -1, colName = -1;

        for (int r = 0; r <= Math.min(sheet.getLastRowNum(), 10); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            boolean hasSkuHeader = false;
            for (int c = 0; c < row.getLastCellNum(); c++) {
                String cs = cellString(row.getCell(c)).toLowerCase();
                if (cs.contains("sku코드") || cs.contains("sku 코드")) {
                    hasSkuHeader = true;
                    headerRow = r;
                    colSku = c;
                }
            }
            if (hasSkuHeader) {
                for (int c = 0; c < row.getLastCellNum(); c++) {
                    String cs = cellString(row.getCell(c)).toLowerCase();
                    if (cs.contains("상품규격") || cs.contains("제품명") || cs.contains("상품명")) colName = c;
                }
            }
            if (headerRow >= 0) break;
        }
        if (headerRow < 0 || colSku < 0 || colName < 0) return map;

        for (int r = headerRow + 1; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            String sku  = cellString(row.getCell(colSku)).trim();
            String name = cellString(row.getCell(colName)).trim();
            if (!sku.isEmpty() && !name.isEmpty()) map.put(name.toLowerCase(), sku);
        }
        return map;
    }

    /** 제품명으로 SKU 코드 fuzzy 조회 */
    private String resolveSkuCode(String productName, Map<String, String> nameToSku) {
        if (productName == null || nameToSku.isEmpty()) return null;
        String lower = productName.toLowerCase();
        if (nameToSku.containsKey(lower)) return nameToSku.get(lower);
        for (Map.Entry<String, String> e : nameToSku.entrySet()) {
            if (lower.contains(e.getKey()) || e.getKey().contains(lower)) return e.getValue();
        }
        return null;
    }

    /** 채널 시트 파싱 → product_cost_channel upsert */
    private int parseChannelSheet(Long companyId, String channelName, Sheet sheet,
                                   Map<String, String> nameToSku) {
        // Channel sheets do not all use the same header row, so detect it.
        int headerRowIdx = findChannelHeaderRow(sheet);
        Row headerRow = sheet.getRow(headerRowIdx);
        if (headerRow == null) return 0;

        // 컬럼 인덱스 매핑
        Map<String, Integer> colMap = new HashMap<>();
        double parsedFeeRate = DEFAULT_CHANNEL_FEE.getOrDefault(channelName, 0.0);
        double parsedMarketingRate = 0.03;
        double parsedAdRate = 0.10;
        double parsedOpexRate = 0.15;

        for (int c = 0; c < headerRow.getLastCellNum(); c++) {
            String h = cellString(headerRow.getCell(c)).trim();
            if (h.isEmpty()) continue;
            String key = channelColumnKey(h);
            if (key == null) continue;
            colMap.putIfAbsent(key, c);
            if ("channel_fee".equals(key)) {
                parsedFeeRate = parseHeaderRate(h, parsedFeeRate);
            } else if ("marketing_rate".equals(key)) {
                parsedMarketingRate = parseHeaderRate(h, parsedMarketingRate);
            } else if ("ad_rate".equals(key)) {
                parsedAdRate = parseHeaderRate(h, parsedAdRate);
            } else if ("opex_rate".equals(key)) {
                parsedOpexRate = parseHeaderRate(h, parsedOpexRate);
            }
        }

        if (!colMap.containsKey("product_code") || !colMap.containsKey("product_name")) {
            log.warn("채널 시트 [{}] 필수 컬럼(제품명/상품코드) 없음", channelName);
            return 0;
        }

        final double feeRate = parsedFeeRate;
        int count = 0;

        for (int r = headerRowIdx + 1; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;

            String productCode = cellString(row.getCell(colMap.get("product_code"))).trim();
            String productName = cellString(row.getCell(colMap.get("product_name"))).trim();
            if (productCode.isEmpty() || productName.isEmpty()) continue;

            // 물류비 시트 매핑으로 SKU 코드 자동 채움
            String skuCode = resolveSkuCode(productName, nameToSku);

            int qty                   = colMap.containsKey("qty")             ? (int) Math.max(1, cellDouble(row.getCell(colMap.get("qty")))) : 1;
            BigDecimal productionCost = colMap.containsKey("production_cost") ? bd(cellDouble(row.getCell(colMap.get("production_cost")))) : BigDecimal.ZERO;
            BigDecimal listPrice      = colMap.containsKey("list_price")      ? bd(cellDouble(row.getCell(colMap.get("list_price"))))      : BigDecimal.ZERO;
            BigDecimal consumerPrice  = colMap.containsKey("consumer_price")  ? bd(cellDouble(row.getCell(colMap.get("consumer_price"))))  : BigDecimal.ZERO;
            BigDecimal consumerShip   = colMap.containsKey("consumer_ship_fee") ? bd(cellDouble(row.getCell(colMap.get("consumer_ship_fee")))) : BigDecimal.ZERO;
            BigDecimal storageFee     = colMap.containsKey("storage_fee")     ? bd(cellDouble(row.getCell(colMap.get("storage_fee"))))     : BigDecimal.ZERO;

            // Rate columns in the upload file are amounts; the actual rates live in headers.
            double channelFeeRate  = feeRate;
            double marketingRate   = parsedMarketingRate;
            double adRate          = parsedAdRate;
            double opexRate        = parsedOpexRate;

            jdbcTemplate.update("""
                INSERT INTO product_cost_channel
                    (company_id, channel_name, product_code, product_name, sku_code,
                     qty_per_unit, production_cost, list_price, consumer_price,
                     channel_fee_rate, marketing_rate, ad_rate, opex_rate,
                     consumer_ship_fee, storage_fee_unit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (company_id, channel_name, product_code) DO UPDATE SET
                    product_name       = EXCLUDED.product_name,
                    sku_code           = COALESCE(EXCLUDED.sku_code, product_cost_channel.sku_code),
                    qty_per_unit       = EXCLUDED.qty_per_unit,
                    production_cost    = EXCLUDED.production_cost,
                    list_price         = EXCLUDED.list_price,
                    consumer_price     = EXCLUDED.consumer_price,
                    channel_fee_rate   = EXCLUDED.channel_fee_rate,
                    marketing_rate     = EXCLUDED.marketing_rate,
                    ad_rate            = EXCLUDED.ad_rate,
                    opex_rate          = EXCLUDED.opex_rate,
                    consumer_ship_fee  = EXCLUDED.consumer_ship_fee,
                    storage_fee_unit   = EXCLUDED.storage_fee_unit,
                    updated_at         = NOW()
                """,
                companyId, channelName, productCode, productName, skuCode,
                qty, productionCost, listPrice, consumerPrice,
                channelFeeRate, marketingRate, adRate, opexRate,
                consumerShip, storageFee);
            count++;
        }
        return count;
    }

    // ──────────────────────────────────────────────────────────────
    // 조회
    // ──────────────────────────────────────────────────────────────

    public Map<String, Object> getAllCostData(Long companyId) {
        Map<String, Object> result = new LinkedHashMap<>();

        // 채널별 제품 원가
        Map<String, List<Map<String, Object>>> channelMap = new LinkedHashMap<>();
        for (String ch : CHANNEL_SHEET_NAMES) channelMap.put(ch, new ArrayList<>());

        List<Map<String, Object>> channels = jdbcTemplate.queryForList("""
            SELECT id, channel_name, product_code, product_name, sku_code,
                   qty_per_unit, production_cost, list_price, consumer_price,
                   channel_fee_rate, marketing_rate, ad_rate, opex_rate,
                   consumer_ship_fee, storage_fee_unit, is_active, note
            FROM product_cost_channel
            WHERE company_id = ?
            ORDER BY channel_name, product_name
            """, companyId);

        for (Map<String, Object> row : channels) {
            String ch = (String) row.get("channel_name");
            channelMap.computeIfAbsent(ch, k -> new ArrayList<>()).add(row);
        }
        result.put("channels", channelMap);

        // SKU 마스터
        repairSkuProductNames(companyId);
        List<Map<String, Object>> skus = jdbcTemplate.queryForList("""
            SELECT id, sku_code, product_name, weight_g, temp_type, production_cost, note
            FROM product_sku_master
            WHERE company_id = ?
            ORDER BY sku_code
            """, companyId);
        result.put("skuMaster", skus);

        // 물류비 구간
        List<Map<String, Object>> logistics = jdbcTemplate.queryForList("""
            SELECT id, temp_type, weight_limit_g, fee
            FROM logistics_fee_config
            WHERE company_id = ?
            ORDER BY temp_type, weight_limit_g
            """, companyId);
        result.put("logisticsFees", logistics);

        return result;
    }

    private void repairSkuProductNames(Long companyId) {
        jdbcTemplate.update("""
            UPDATE product_sku_master sku
            SET product_name = source.product_name,
                updated_at = NOW()
            FROM (
                SELECT DISTINCT ON (sku_code)
                       sku_code,
                       product_name
                FROM product_cost_channel
                WHERE company_id = ?
                  AND NULLIF(TRIM(COALESCE(sku_code, '')), '') IS NOT NULL
                  AND NULLIF(TRIM(COALESCE(product_name, '')), '') IS NOT NULL
                ORDER BY sku_code, LENGTH(product_name) DESC, product_name
            ) source
            WHERE sku.company_id = ?
              AND sku.sku_code = source.sku_code
              AND NULLIF(TRIM(COALESCE(sku.product_name, '')), '') IS NULL
            """, companyId, companyId);
    }

    public List<Map<String, Object>> getChannelProducts(Long companyId, String channelName) {
        return jdbcTemplate.queryForList("""
            SELECT id, channel_name, product_code, product_name, sku_code,
                   qty_per_unit, production_cost, list_price, consumer_price,
                   channel_fee_rate, marketing_rate, ad_rate, opex_rate,
                   consumer_ship_fee, storage_fee_unit, is_active, note
            FROM product_cost_channel
            WHERE company_id = ? AND channel_name = ?
            ORDER BY product_name
            """, companyId, channelName);
    }

    // ──────────────────────────────────────────────────────────────
    // product_cost_channel CRUD
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> saveChannelProduct(Long companyId, Map<String, Object> payload) {
        String channelName  = str(payload, "channel_name");
        String productCode  = str(payload, "product_code");
        String productName  = str(payload, "product_name");
        String skuCode      = (String) payload.get("sku_code");
        int    qtyPerUnit   = intVal(payload, "qty_per_unit", 1);
        BigDecimal prodCost = bdVal(payload, "production_cost");
        BigDecimal listPx   = bdVal(payload, "list_price");
        BigDecimal consPx   = bdVal(payload, "consumer_price");
        double chanFeeRate  = dblVal(payload, "channel_fee_rate");
        double mktRate      = dblVal(payload, "marketing_rate");
        double adRate       = dblVal(payload, "ad_rate");
        double opexRate     = dblVal(payload, "opex_rate");
        BigDecimal shipFee  = bdVal(payload, "consumer_ship_fee");
        BigDecimal storFee  = bdVal(payload, "storage_fee_unit");
        boolean isActive    = payload.get("is_active") == null || Boolean.TRUE.equals(payload.get("is_active"));
        String note         = (String) payload.getOrDefault("note", "");

        jdbcTemplate.update("""
            INSERT INTO product_cost_channel
                (company_id, channel_name, product_code, product_name, sku_code,
                 qty_per_unit, production_cost, list_price, consumer_price,
                 channel_fee_rate, marketing_rate, ad_rate, opex_rate,
                 consumer_ship_fee, storage_fee_unit, is_active, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (company_id, channel_name, product_code) DO UPDATE SET
                product_name      = EXCLUDED.product_name,
                sku_code          = EXCLUDED.sku_code,
                qty_per_unit      = EXCLUDED.qty_per_unit,
                production_cost   = EXCLUDED.production_cost,
                list_price        = EXCLUDED.list_price,
                consumer_price    = EXCLUDED.consumer_price,
                channel_fee_rate  = EXCLUDED.channel_fee_rate,
                marketing_rate    = EXCLUDED.marketing_rate,
                ad_rate           = EXCLUDED.ad_rate,
                opex_rate         = EXCLUDED.opex_rate,
                consumer_ship_fee = EXCLUDED.consumer_ship_fee,
                storage_fee_unit  = EXCLUDED.storage_fee_unit,
                is_active         = EXCLUDED.is_active,
                note              = EXCLUDED.note,
                updated_at        = NOW()
            """,
            companyId, channelName, productCode, productName, skuCode,
            qtyPerUnit, prodCost, listPx, consPx,
            chanFeeRate, mktRate, adRate, opexRate,
            shipFee, storFee, isActive, note);

        return getOneChannelProduct(companyId, channelName, productCode);
    }

    @Transactional
    public Map<String, Object> updateChannelProduct(Long companyId, Long id, Map<String, Object> payload) {
        jdbcTemplate.update("""
            UPDATE product_cost_channel SET
                product_name      = ?,
                sku_code          = ?,
                qty_per_unit      = ?,
                production_cost   = ?,
                list_price        = ?,
                consumer_price    = ?,
                channel_fee_rate  = ?,
                marketing_rate    = ?,
                ad_rate           = ?,
                opex_rate         = ?,
                consumer_ship_fee = ?,
                storage_fee_unit  = ?,
                is_active         = ?,
                note              = ?,
                updated_at        = NOW()
            WHERE id = ? AND company_id = ?
            """,
            str(payload, "product_name"),
            payload.get("sku_code"),
            intVal(payload, "qty_per_unit", 1),
            bdVal(payload, "production_cost"),
            bdVal(payload, "list_price"),
            bdVal(payload, "consumer_price"),
            dblVal(payload, "channel_fee_rate"),
            dblVal(payload, "marketing_rate"),
            dblVal(payload, "ad_rate"),
            dblVal(payload, "opex_rate"),
            bdVal(payload, "consumer_ship_fee"),
            bdVal(payload, "storage_fee_unit"),
            payload.get("is_active") == null || Boolean.TRUE.equals(payload.get("is_active")),
            payload.getOrDefault("note", ""),
            id, companyId);

        return jdbcTemplate.queryForList(
                "SELECT * FROM product_cost_channel WHERE id = ?", id)
                .stream().findFirst().orElse(Map.of());
    }

    @Transactional
    public void deleteChannelProduct(Long companyId, Long id) {
        jdbcTemplate.update("DELETE FROM product_cost_channel WHERE id = ? AND company_id = ?", id, companyId);
    }

    // ──────────────────────────────────────────────────────────────
    // product_sku_master CRUD
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> saveSku(Long companyId, Map<String, Object> payload) {
        jdbcTemplate.update("""
            INSERT INTO product_sku_master (company_id, sku_code, product_name, weight_g, temp_type, production_cost, note)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (company_id, sku_code) DO UPDATE SET
                product_name    = EXCLUDED.product_name,
                weight_g        = EXCLUDED.weight_g,
                temp_type       = EXCLUDED.temp_type,
                production_cost = EXCLUDED.production_cost,
                note            = EXCLUDED.note,
                updated_at      = NOW()
            """,
            companyId,
            str(payload, "sku_code"),
            str(payload, "product_name"),
            intVal(payload, "weight_g", 0),
            payload.getOrDefault("temp_type", "상온"),
            bdVal(payload, "production_cost"),
            payload.getOrDefault("note", ""));

        return jdbcTemplate.queryForList(
                "SELECT * FROM product_sku_master WHERE company_id = ? AND sku_code = ?",
                companyId, str(payload, "sku_code"))
                .stream().findFirst().orElse(Map.of());
    }

    @Transactional
    public Map<String, Object> updateSku(Long companyId, Long id, Map<String, Object> payload) {
        jdbcTemplate.update("""
            UPDATE product_sku_master SET
                sku_code        = ?,
                product_name    = ?,
                weight_g        = ?,
                temp_type       = ?,
                production_cost = ?,
                note            = ?,
                updated_at      = NOW()
            WHERE id = ? AND company_id = ?
            """,
            str(payload, "sku_code"),
            str(payload, "product_name"),
            intVal(payload, "weight_g", 0),
            payload.getOrDefault("temp_type", "상온"),
            bdVal(payload, "production_cost"),
            payload.getOrDefault("note", ""),
            id, companyId);

        return jdbcTemplate.queryForList(
                "SELECT * FROM product_sku_master WHERE id = ? AND company_id = ?",
                id, companyId)
                .stream().findFirst().orElse(Map.of());
    }

    @Transactional
    public void deleteSku(Long companyId, Long id) {
        jdbcTemplate.update("DELETE FROM product_sku_master WHERE id = ? AND company_id = ?", id, companyId);
    }

    // ──────────────────────────────────────────────────────────────
    // logistics_fee_config CRUD
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> saveLogisticsFee(Long companyId, Map<String, Object> payload) {
        String tempType     = str(payload, "temp_type");
        int weightLimit     = intVal(payload, "weight_limit_g", 999999);
        BigDecimal fee      = bdVal(payload, "fee");

        jdbcTemplate.update("""
            INSERT INTO logistics_fee_config (company_id, temp_type, weight_limit_g, fee)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (company_id, temp_type, weight_limit_g) DO UPDATE SET
                fee = EXCLUDED.fee
            """,
            companyId, tempType, weightLimit, fee);

        return jdbcTemplate.queryForList(
                "SELECT * FROM logistics_fee_config WHERE company_id = ? AND temp_type = ? AND weight_limit_g = ?",
                companyId, tempType, weightLimit)
                .stream().findFirst().orElse(Map.of());
    }

    @Transactional
    public void deleteLogisticsFee(Long companyId, Long id) {
        jdbcTemplate.update("DELETE FROM logistics_fee_config WHERE id = ? AND company_id = ?", id, companyId);
    }

    // ──────────────────────────────────────────────────────────────
    // 원가 계산 유틸 (채널별 실제 매출 페이지에서 사용)
    // ──────────────────────────────────────────────────────────────

    /**
     * 주어진 companyId 의 전체 원가 매핑을 로드.
     * key = "channelName::productCode"
     */
    public Map<String, Map<String, Object>> loadCostMap(Long companyId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT pcc.channel_name, pcc.product_code, pcc.production_cost,
                   pcc.channel_fee_rate, pcc.marketing_rate, pcc.ad_rate, pcc.opex_rate,
                   pcc.consumer_ship_fee, pcc.storage_fee_unit, pcc.qty_per_unit,
                   pcc.sku_code,
                   psm.weight_g, psm.temp_type
            FROM product_cost_channel pcc
            LEFT JOIN product_sku_master psm
                   ON psm.company_id = pcc.company_id AND psm.sku_code = pcc.sku_code
            WHERE pcc.company_id = ? AND pcc.is_active = TRUE
            """, companyId);

        Map<String, Map<String, Object>> map = new HashMap<>();
        for (Map<String, Object> row : rows) {
            String key = row.get("channel_name") + "::" + row.get("product_code");
            map.put(key, row);
        }
        return map;
    }

    /**
     * 물류비 구간 테이블 로드.
     * key = "tempType" (상온/냉동), value = sorted list of {weight_limit_g, fee}
     */
    public Map<String, List<Map<String, Object>>> loadLogisticsTable(Long companyId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            SELECT temp_type, weight_limit_g, fee
            FROM logistics_fee_config
            WHERE company_id = ?
            ORDER BY temp_type, weight_limit_g ASC
            """, companyId);

        Map<String, List<Map<String, Object>>> table = new HashMap<>();
        for (Map<String, Object> row : rows) {
            String tt = (String) row.get("temp_type");
            table.computeIfAbsent(tt, k -> new ArrayList<>()).add(row);
        }
        return table;
    }

    /**
     * 물류비 계산: weight_g 와 temp_type 으로 구간 적용
     */
    public static BigDecimal calcLogisticsFee(
            int weightG, String tempType, Map<String, List<Map<String, Object>>> logisticsTable) {
        List<Map<String, Object>> tiers = logisticsTable.get(tempType);
        if (tiers == null || tiers.isEmpty()) {
            tiers = logisticsTable.get("상온");
        }
        if (tiers == null || tiers.isEmpty()) return BigDecimal.ZERO;

        for (Map<String, Object> tier : tiers) {
            int limit = ((Number) tier.get("weight_limit_g")).intValue();
            if (weightG <= limit) {
                return new BigDecimal(tier.get("fee").toString());
            }
        }
        // 마지막 구간 fallback
        Object last = tiers.get(tiers.size() - 1).get("fee");
        return new BigDecimal(last.toString());
    }

    // ──────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────

    private Map<String, Object> getOneChannelProduct(Long companyId, String channelName, String productCode) {
        return jdbcTemplate.queryForList("""
                SELECT * FROM product_cost_channel
                WHERE company_id = ? AND channel_name = ? AND product_code = ?
                """, companyId, channelName, productCode)
                .stream().findFirst().orElse(Map.of());
    }

    private int findChannelHeaderRow(Sheet sheet) {
        for (int r = 0; r <= Math.min(sheet.getLastRowNum(), 12); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;

            boolean hasProductName = false;
            boolean hasProductCode = false;
            for (int c = 0; c < row.getLastCellNum(); c++) {
                String key = channelColumnKey(cellString(row.getCell(c)));
                if ("product_name".equals(key)) hasProductName = true;
                if ("product_code".equals(key)) hasProductCode = true;
            }
            if (hasProductName && hasProductCode) return r;
        }
        return 4;
    }

    private String channelColumnKey(String header) {
        String h = normalizeHeader(header);
        if (h.isEmpty()) return null;
        if (h.contains("소비자운반비")) return "consumer_ship_fee";
        if (h.contains("보관비") && h.contains("개당") && !h.contains("total")) return "storage_fee";
        if (h.equals("제품명") || h.equals("상품명")) return "product_name";
        if (h.equals("상품코드")) return "product_code";
        if (h.contains("수량")) return "qty";
        if (h.equals("생산원가")) return "production_cost";
        if (h.equals("정가") || h.contains("등록판매가")) return "list_price";
        if (h.contains("일반소비자가") || h.equals("소비자가")) return "consumer_price";
        if (h.contains("마케팅")) return "marketing_rate";
        if (h.contains("광고")) return "ad_rate";
        if (h.contains("운영") && h.contains("판관비")) return "opex_rate";
        if (h.contains("채널") && h.contains("수수료")) return "channel_fee";
        return null;
    }

    private String normalizeHeader(String value) {
        if (value == null) return "";
        return value
                .replaceAll("\\s+", "")
                .replace("(", "")
                .replace(")", "")
                .toLowerCase(Locale.ROOT);
    }

    private double parseHeaderRate(String header, double fallback) {
        Matcher m = Pattern.compile("(\\d+(?:\\.\\d+)?)%").matcher(header);
        if (!m.find()) return fallback;
        return Double.parseDouble(m.group(1)) / 100.0;
    }

    private String cellString(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double v = cell.getNumericCellValue();
                yield v == Math.floor(v) ? String.valueOf((long) v) : String.valueOf(v);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try { yield String.valueOf((long) cell.getNumericCellValue()); }
                catch (Exception e) { yield cell.getStringCellValue(); }
            }
            default -> "";
        };
    }

    private double cellDouble(Cell cell) {
        if (cell == null) return 0;
        return switch (cell.getCellType()) {
            case NUMERIC -> cell.getNumericCellValue();
            case STRING  -> {
                String s = cell.getStringCellValue().replaceAll("[^0-9.\\-]", "");
                yield s.isEmpty() || "-".equals(s) || ".".equals(s) || "-.".equals(s)
                        ? 0
                        : Double.parseDouble(s);
            }
            case FORMULA -> {
                try { yield cell.getNumericCellValue(); } catch (Exception e) { yield 0; }
            }
            default -> 0;
        };
    }

    /** 0.06 / 6.0 양쪽 허용 — 1 이상이면 /100 처리 */
    private double normalizeRate(double raw) {
        if (raw == 0) return 0;
        return raw >= 1 ? raw / 100.0 : raw;
    }

    private String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v == null ? "" : v.toString();
    }

    private int intVal(Map<String, Object> m, String k, int def) {
        Object v = m.get(k);
        if (v == null) return def;
        try { return Integer.parseInt(v.toString()); } catch (Exception e) { return def; }
    }

    private double dblVal(Map<String, Object> m, String k) {
        Object v = m.get(k);
        if (v == null) return 0;
        try { return Double.parseDouble(v.toString()); } catch (Exception e) { return 0; }
    }

    private BigDecimal bdVal(Map<String, Object> m, String k) {
        Object v = m.get(k);
        if (v == null) return BigDecimal.ZERO;
        try { return new BigDecimal(v.toString()).setScale(2, RoundingMode.HALF_UP); }
        catch (Exception e) { return BigDecimal.ZERO; }
    }

    private BigDecimal bd(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
