package naeil.dashboard.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.PromotionHistoryDTO;
import naeil.dashboard.dto.PromotionMarginFormDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 프로모션 마진 서비스
   *
   * 주요 흐름:
   *  1. saveForm()      : 직원이 "서식 저장" 클릭 → promotion_margin_form 저장(draft)
   *  2. submitForm()    : 직원이 하단 "서식 저장(제출)" 클릭 → status=submitted 로 변경 +
   *                       promotion_history 레코드 자동 생성 (프로모션 내역 연동)
   *  3. getHistory()    : 채널별 프로모션 내역 조회 (목표 매출/실시간 매출/실시간 영업이익)
   *  4. updateActuals() : 실시간 매출 & 비용 갱신
   */
@Service
  @RequiredArgsConstructor
  public class PromotionMarginService {

    private final NamedParameterJdbcTemplate namedJdbc;
        private final JdbcTemplate jdbc;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. 서식 저장 (draft)
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
        public Long saveForm(PromotionMarginFormDTO.Request req, String username) {
                  String sql = """
                                INSERT INTO promotion_margin_form (
                                    company_id, created_by, form_name, channel, promotion_type,
                                    product_name, sku_code,
                                    sale_price, discount_rate, discount_amount,
                                    cogs, logistics_cost, marketing_cost, platform_fee_rate, other_cost,
                                    target_qty,
                                    promo_start_date, promo_end_date,
                                    status, memo
                                ) VALUES (
                                    :companyId, :createdBy, :formName, :channel, :promotionType,
                                    :productName, :skuCode,
                                    :salePrice, :discountRate, :discountAmount,
                                    :cogs, :logisticsCost, :marketingCost, :platformFeeRate, :otherCost,
                                    :targetQty,
                                    :promoStartDate, :promoEndDate,
                                    'draft', :memo
                                )
                                """;

            MapSqlParameterSource params = new MapSqlParameterSource()
                          .addValue("companyId",      req.getCompanyId())
                          .addValue("createdBy",      username)
                          .addValue("formName",       req.getFormName())
                          .addValue("channel",        req.getChannel())
                          .addValue("promotionType",  req.getPromotionType())
                          .addValue("productName",    req.getProductName())
                          .addValue("skuCode",        req.getSkuCode())
                          .addValue("salePrice",      req.getSalePrice())
                          .addValue("discountRate",   req.getDiscountRate())
                          .addValue("discountAmount", req.getDiscountAmount())
                          .addValue("cogs",           req.getCogs())
                          .addValue("logisticsCost",  req.getLogisticsCost())
                          .addValue("marketingCost",  req.getMarketingCost())
                          .addValue("platformFeeRate",req.getPlatformFeeRate())
                          .addValue("otherCost",      req.getOtherCost())
                          .addValue("targetQty",      req.getTargetQty())
                          .addValue("promoStartDate", req.getPromoStartDate())
                          .addValue("promoEndDate",   req.getPromoEndDate())
                          .addValue("memo",           req.getMemo());

            KeyHolder keyHolder = new GeneratedKeyHolder();
                  namedJdbc.update(sql, params, keyHolder, new String[]{"id"});
                  return keyHolder.getKey().longValue();
        }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. 서식 제출 → 프로모션 내역 자동 연동
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
        public Long submitForm(Long formId, Long companyId, String username) {
                  // 2-1. form status → submitted
            namedJdbc.update(
                          "UPDATE promotion_margin_form SET status='submitted', updated_at=NOW() WHERE id=:id AND company_id=:cid",
                          Map.of("id", formId, "cid", companyId));

            // 2-2. form 데이터 조회
            Map<String, Object> form = namedJdbc.queryForMap(
                          "SELECT * FROM promotion_margin_form WHERE id=:id",
                          Map.of("id", formId));

            // 2-3. 목표 영업이익 계산
            //   = (sale_price - discount_amount - cogs - logistics_cost
            //      - marketing_cost - sale_price * platform_fee_rate/100 - other_cost) * target_qty
            BigDecimal salePrice      = toBD(form.get("sale_price"));
                  BigDecimal discountAmount = toBD(form.get("discount_amount"));
                  BigDecimal cogs           = toBD(form.get("cogs"));
                  BigDecimal logisticsCost  = toBD(form.get("logistics_cost"));
                  BigDecimal marketingCost  = toBD(form.get("marketing_cost"));
                  BigDecimal platformFeeRate= toBD(form.get("platform_fee_rate"));
                  BigDecimal otherCost      = toBD(form.get("other_cost"));
                  int        targetQty      = ((Number) form.get("target_qty")).intValue();

            BigDecimal platformFee    = salePrice.multiply(platformFeeRate)
                                                           .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                  BigDecimal unitProfit     = salePrice.subtract(discountAmount)
                                                                 .subtract(cogs)
                                                                 .subtract(logisticsCost)
                                                                 .subtract(marketingCost)
                                                                 .subtract(platformFee)
                                                                 .subtract(otherCost);
                  BigDecimal targetRevenue  = salePrice.subtract(discountAmount)
                                                                 .multiply(BigDecimal.valueOf(targetQty));
                  BigDecimal targetOpProfit = unitProfit.multiply(BigDecimal.valueOf(targetQty));

            // 2-4. promotion_history 레코드 생성
            String insertSql = """
                          INSERT INTO promotion_history (
                              company_id, form_id, created_by, channel, promotion_type,
                              product_name, sku_code,
                              target_revenue, target_qty, target_operating_profit,
                              promo_start_date, promo_end_date, memo
                          ) VALUES (
                              :companyId, :formId, :createdBy, :channel, :promotionType,
                              :productName, :skuCode,
                              :targetRevenue, :targetQty, :targetOperatingProfit,
                              :promoStartDate, :promoEndDate, :memo
                          )
                          """;

            MapSqlParameterSource hp = new MapSqlParameterSource()
                          .addValue("companyId",             companyId)
                          .addValue("formId",                formId)
                          .addValue("createdBy",             username)
                          .addValue("channel",               form.get("channel"))
                          .addValue("promotionType",         form.get("promotion_type"))
                          .addValue("productName",           form.get("product_name"))
                          .addValue("skuCode",               form.get("sku_code"))
                          .addValue("targetRevenue",         targetRevenue)
                          .addValue("targetQty",             targetQty)
                          .addValue("targetOperatingProfit", targetOpProfit)
                          .addValue("promoStartDate",        form.get("promo_start_date"))
                          .addValue("promoEndDate",          form.get("promo_end_date"))
                          .addValue("memo",                  form.get("memo"));

            KeyHolder keyHolder = new GeneratedKeyHolder();
                  namedJdbc.update(insertSql, hp, keyHolder, new String[]{"id"});
                  return keyHolder.getKey().longValue();
        }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. 프로모션 내역 조회 (채널별 집계)
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
        public List<PromotionHistoryDTO.ChannelSummary> getHistory(Long companyId, String channel) {
                  String sql = """
                                SELECT id, company_id, form_id, created_by,
                                       channel, promotion_type, product_name, sku_code,
                                       target_revenue, target_qty, target_operating_profit,
                                       actual_qty, actual_revenue,
                                       actual_cogs, actual_logistics, actual_marketing,
                                       actual_platform_fee, actual_other_cost,
                                       actual_operating_profit, revenue_achievement_rate,
                                       promo_start_date, promo_end_date,
                                       submitted_at, last_synced_at, memo,
                                       created_at, updated_at
                                FROM promotion_history
                                WHERE company_id = :companyId
                                  AND (:channel IS NULL OR channel = :channel)
                                ORDER BY promo_start_date DESC
                                """;

            List<Map<String, Object>> rows = namedJdbc.queryForList(sql,
                                                                                Map.of("companyId", companyId, "channel", channel));

            List<PromotionHistoryDTO.Response> items = rows.stream()
                          .map(this::mapHistoryRow)
                          .collect(Collectors.toList());

            // 채널별로 그룹화
            Map<String, List<PromotionHistoryDTO.Response>> grouped = items.stream()
                          .collect(Collectors.groupingBy(PromotionHistoryDTO.Response::getChannel));

            return grouped.entrySet().stream().map(e -> {
                          List<PromotionHistoryDTO.Response> list = e.getValue();
                          BigDecimal totalTarget  = list.stream()
                                            .map(r -> r.getTargetRevenue() != null ? r.getTargetRevenue() : BigDecimal.ZERO)
                                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                          BigDecimal totalActual  = list.stream()
                                            .map(r -> r.getActualRevenue() != null ? r.getActualRevenue() : BigDecimal.ZERO)
                                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                          BigDecimal totalProfit  = list.stream()
                                            .map(r -> r.getActualOperatingProfit() != null ? r.getActualOperatingProfit() : BigDecimal.ZERO)
                                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                          BigDecimal achieveRate  = totalTarget.compareTo(BigDecimal.ZERO) == 0
                                            ? BigDecimal.ZERO
                                            : totalActual.divide(totalTarget, 4, RoundingMode.HALF_UP)
                                                         .multiply(BigDecimal.valueOf(100))
                                                         .setScale(2, RoundingMode.HALF_UP);

                                                               return PromotionHistoryDTO.ChannelSummary.builder()
                                                                                 .channel(e.getKey())
                                                                                 .promotionCount(list.size())
                                                                                 .totalTargetRevenue(totalTarget)
                                                                                 .totalActualRevenue(totalActual)
                                                                                 .totalActualOperatingProfit(totalProfit)
                                                                                 .overallAchievementRate(achieveRate)
                                                                                 .items(list)
                                                                                 .build();
            }).collect(Collectors.toList());
        }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. 실시간 실적 업데이트
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
        public void updateActuals(PromotionHistoryDTO.ActualUpdateRequest req) {
                  String sql = """
                                UPDATE promotion_history SET
                                    actual_qty          = :actualQty,
                                    actual_revenue      = :actualRevenue,
                                    actual_cogs         = :actualCogs,
                                    actual_logistics    = :actualLogistics,
                                    actual_marketing    = :actualMarketing,
                                    actual_platform_fee = :actualPlatformFee,
                                    actual_other_cost   = :actualOtherCost,
                                    last_synced_at      = NOW(),
                                    updated_at          = NOW()
                                WHERE id = :id
                                """;

            namedJdbc.update(sql, new MapSqlParameterSource()
                                         .addValue("id",               req.getId())
                                         .addValue("actualQty",        req.getActualQty())
                                         .addValue("actualRevenue",    req.getActualRevenue())
                                         .addValue("actualCogs",       req.getActualCogs())
                                         .addValue("actualLogistics",  req.getActualLogistics())
                                         .addValue("actualMarketing",  req.getActualMarketing())
                                         .addValue("actualPlatformFee",req.getActualPlatformFee())
                                         .addValue("actualOtherCost",  req.getActualOtherCost()));
        }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. 서식 목록 조회
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
        public List<PromotionMarginFormDTO.Response> getForms(Long companyId, String channel) {
                  String sql = """
                                SELECT id, company_id, created_by, form_name, channel,
                                       promotion_type, product_name, sku_code,
                                       sale_price, discount_rate, discount_amount,
                                       cogs, logistics_cost, marketing_cost, platform_fee_rate, other_cost,
                                       target_qty, target_revenue,
                                       promo_start_date, promo_end_date,
                                       status, memo, created_at, updated_at
                                FROM promotion_margin_form
                                WHERE company_id = :companyId
                                  AND (:channel IS NULL OR channel = :channel)
                                ORDER BY created_at DESC
                                """;

            return namedJdbc.queryForList(sql,
                                                      Map.of("companyId", companyId, "channel", channel))
                          .stream().map(this::mapFormRow).collect(Collectors.toList());
        }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper
    // ─────────────────────────────────────────────────────────────────────────
    private PromotionHistoryDTO.Response mapHistoryRow(Map<String, Object> r) {
              return PromotionHistoryDTO.Response.builder()
                            .id(toLong(r.get("id")))
                            .companyId(toLong(r.get("company_id")))
                            .formId(toLong(r.get("form_id")))
                            .createdBy((String) r.get("created_by"))
                            .channel((String) r.get("channel"))
                            .promotionType((String) r.get("promotion_type"))
                            .productName((String) r.get("product_name"))
                            .skuCode((String) r.get("sku_code"))
                            .targetRevenue(toBD(r.get("target_revenue")))
                            .targetQty(toInt(r.get("target_qty")))
                            .targetOperatingProfit(toBD(r.get("target_operating_profit")))
                            .actualQty(toInt(r.get("actual_qty")))
                            .actualRevenue(toBD(r.get("actual_revenue")))
                            .actualCogs(toBD(r.get("actual_cogs")))
                            .actualLogistics(toBD(r.get("actual_logistics")))
                            .actualMarketing(toBD(r.get("actual_marketing")))
                            .actualPlatformFee(toBD(r.get("actual_platform_fee")))
                            .actualOtherCost(toBD(r.get("actual_other_cost")))
                            .actualOperatingProfit(toBD(r.get("actual_operating_profit")))
                            .revenueAchievementRate(toBD(r.get("revenue_achievement_rate")))
                            .promoStartDate(toLocalDate(r.get("promo_start_date")))
                            .promoEndDate(toLocalDate(r.get("promo_end_date")))
                            .submittedAt(toODT(r.get("submitted_at")))
                            .lastSyncedAt(toODT(r.get("last_synced_at")))
                            .memo((String) r.get("memo"))
                            .createdAt(toODT(r.get("created_at")))
                            .updatedAt(toODT(r.get("updated_at")))
                            .build();
    }

    private PromotionMarginFormDTO.Response mapFormRow(Map<String, Object> r) {
              return PromotionMarginFormDTO.Response.builder()
                            .id(toLong(r.get("id")))
                            .companyId(toLong(r.get("company_id")))
                            .createdBy((String) r.get("created_by"))
                            .formName((String) r.get("form_name"))
                            .channel((String) r.get("channel"))
                            .promotionType((String) r.get("promotion_type"))
                            .productName((String) r.get("product_name"))
                            .skuCode((String) r.get("sku_code"))
                            .salePrice(toBD(r.get("sale_price")))
                            .discountRate(toBD(r.get("discount_rate")))
                            .discountAmount(toBD(r.get("discount_amount")))
                            .cogs(toBD(r.get("cogs")))
                            .logisticsCost(toBD(r.get("logistics_cost")))
                            .marketingCost(toBD(r.get("marketing_cost")))
                            .platformFeeRate(toBD(r.get("platform_fee_rate")))
                            .otherCost(toBD(r.get("other_cost")))
                            .targetQty(toInt(r.get("target_qty")))
                            .targetRevenue(toBD(r.get("target_revenue")))
                            .promoStartDate(toLocalDate(r.get("promo_start_date")))
                            .promoEndDate(toLocalDate(r.get("promo_end_date")))
                            .status((String) r.get("status"))
                            .memo((String) r.get("memo"))
                            .createdAt(toODT(r.get("created_at")))
                            .updatedAt(toODT(r.get("updated_at")))
                            .build();
    }

    private BigDecimal toBD(Object v) {
              if (v == null) return BigDecimal.ZERO;
              if (v instanceof BigDecimal bd) return bd;
              return new BigDecimal(v.toString());
    }
        private Long toLong(Object v) {
                  if (v == null) return null;
                  return ((Number) v).longValue();
        }
        private int toInt(Object v) {
                  if (v == null) return 0;
                  return ((Number) v).intValue();
        }
        private java.time.LocalDate toLocalDate(Object v) {
                  if (v == null) return null;
                  if (v instanceof java.sql.Date d) return d.toLocalDate();
                  return java.time.LocalDate.parse(v.toString());
        }
        private OffsetDateTime toODT(Object v) {
                  if (v == null) return null;
                  if (v instanceof java.sql.Timestamp ts) return ts.toInstant().atOffset(java.time.ZoneOffset.UTC);
                  if (v instanceof OffsetDateTime odt) return odt;
                  return OffsetDateTime.parse(v.toString());
        }
  }
