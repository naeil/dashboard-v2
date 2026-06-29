package naeil.dashboard.service;

import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.IncentiveDto;
import naeil.dashboard.entity.ClientPerformance;
import naeil.dashboard.entity.IncentiveSummary;
import naeil.dashboard.entity.OnlineChannelPerformance;
import naeil.dashboard.repository.ClientPerformanceRepository;
import naeil.dashboard.repository.IncentiveSummaryRepository;
import naeil.dashboard.repository.OnlineChannelPerformanceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IncentiveService {

    private final OnlineChannelPerformanceRepository onlineRepo;
    private final ClientPerformanceRepository clientRepo;
    private final IncentiveSummaryRepository summaryRepo;

    private static final long ONLINE_THRESHOLD = 3_000_000L;
    private static final double ONLINE_POOL_RATE = 0.10;

    private static final long NEW_CLIENT_FIXED_AMOUNT = 50_000L;
    private static final double FIRST_ORDER_RATE = 0.01;
    private static final long TIER2_THRESHOLD = 10_000_000L;
    private static final long TIER3_THRESHOLD = 30_000_000L;
    private static final double TIER1_RATE = 0.01;
    private static final double TIER2_RATE = 0.02;
    private static final double TIER3_RATE = 0.03;

    @Transactional(readOnly = true)
    public List<IncentiveDto.OnlinePerformanceResponse> getOnlinePerformances(String month) {
        String targetMonth = resolveMonth(month);
        List<OnlineChannelPerformance> list = onlineRepo.findByPerformanceMonthOrderByChannelNameAsc(targetMonth);
        long totalProfit = list.stream()
                .filter(o -> Boolean.TRUE.equals(o.getIncentiveEligible()))
                .mapToLong(o -> o.getOperatingProfit() == null ? 0 : o.getOperatingProfit())
                .sum();
        long pool = calculateOnlinePool(totalProfit);
        Map<String, Long> assigneeProfit = new HashMap<>();
        for (OnlineChannelPerformance o : list) {
            if (Boolean.TRUE.equals(o.getIncentiveEligible()) && o.getAssigneeName() != null) {
                assigneeProfit.merge(o.getAssigneeName(),
                        o.getOperatingProfit() == null ? 0 : o.getOperatingProfit(), Long::sum);
            }
        }
        return list.stream().map(o -> {
            long expectedIncentive = 0L;
            if (pool > 0 && totalProfit > 0 && Boolean.TRUE.equals(o.getIncentiveEligible()) && o.getAssigneeName() != null) {
                long ap = assigneeProfit.getOrDefault(o.getAssigneeName(), 0L);
                double ratio = totalProfit > 0 ? (double) ap / totalProfit : 0;
                expectedIncentive = Math.round(pool * ratio);
            }
            return IncentiveDto.OnlinePerformanceResponse.builder()
                    .id(o.getId()).performanceMonth(o.getPerformanceMonth())
                    .channelName(o.getChannelName()).assigneeName(o.getAssigneeName())
                    .salesAmount(o.getSalesAmount()).manufacturingCost(o.getManufacturingCost())
                    .advertisingCost(o.getAdvertisingCost()).commissionCost(o.getCommissionCost())
                    .logisticsCost(o.getLogisticsCost()).otherCost(o.getOtherCost())
                    .operatingProfit(o.getOperatingProfit()).incentiveEligible(o.getIncentiveEligible())
                    .expectedIncentive(expectedIncentive).memo(o.getMemo())
                    .createdAt(o.getCreatedAt()).updatedAt(o.getUpdatedAt()).build();
        }).collect(Collectors.toList());
    }

    @Transactional
    public IncentiveDto.OnlinePerformanceResponse createOnlinePerformance(IncentiveDto.OnlinePerformanceRequest req) {
        OnlineChannelPerformance entity = OnlineChannelPerformance.builder()
                .performanceMonth(req.getPerformanceMonth()).channelName(req.getChannelName())
                .assigneeName(req.getAssigneeName()).salesAmount(nvl(req.getSalesAmount()))
                .manufacturingCost(nvl(req.getManufacturingCost())).advertisingCost(nvl(req.getAdvertisingCost()))
                .commissionCost(nvl(req.getCommissionCost())).logisticsCost(nvl(req.getLogisticsCost()))
                .otherCost(nvl(req.getOtherCost()))
                .incentiveEligible(req.getIncentiveEligible() != null ? req.getIncentiveEligible() : true)
                .memo(req.getMemo()).build();
        entity.recalculateOperatingProfit();
        entity = onlineRepo.save(entity);
        return toOnlineResponse(entity, 0L);
    }

    @Transactional
    public IncentiveDto.OnlinePerformanceResponse updateOnlinePerformance(Long id, IncentiveDto.OnlinePerformanceRequest req) {
        OnlineChannelPerformance entity = onlineRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("OnlineChannelPerformance not found: " + id));
        entity.setChannelName(req.getChannelName()); entity.setAssigneeName(req.getAssigneeName());
        entity.setSalesAmount(nvl(req.getSalesAmount())); entity.setManufacturingCost(nvl(req.getManufacturingCost()));
        entity.setAdvertisingCost(nvl(req.getAdvertisingCost())); entity.setCommissionCost(nvl(req.getCommissionCost()));
        entity.setLogisticsCost(nvl(req.getLogisticsCost())); entity.setOtherCost(nvl(req.getOtherCost()));
        entity.setIncentiveEligible(req.getIncentiveEligible() != null ? req.getIncentiveEligible() : true);
        entity.setMemo(req.getMemo()); entity.recalculateOperatingProfit();
        entity = onlineRepo.save(entity);
        return toOnlineResponse(entity, 0L);
    }

    @Transactional
    public void deleteOnlinePerformance(Long id) { onlineRepo.deleteById(id); }

    @Transactional(readOnly = true)
    public List<IncentiveDto.ClientPerformanceResponse> getClientPerformances(String month) {
        List<ClientPerformance> list = clientRepo.findAllByOrderByCreatedAtDesc();
        return list.stream().map(this::toClientResponse).collect(Collectors.toList());
    }

    @Transactional
    public IncentiveDto.ClientPerformanceResponse createClientPerformance(IncentiveDto.ClientPerformanceRequest req) {
        ClientPerformance entity = ClientPerformance.builder()
                .clientName(req.getClientName()).assigneeName(req.getAssigneeName())
                .firstRegisteredDate(req.getFirstRegisteredDate() != null ? req.getFirstRegisteredDate() : LocalDate.now())
                .firstOrderDate(req.getFirstOrderDate()).firstOrderAmount(nvl(req.getFirstOrderAmount()))
                .cumulativeSales(nvl(req.getCumulativeSales()))
                .cumulativeOperatingProfit(nvl(req.getCumulativeOperatingProfit()))
                .marginRate(req.getMarginRate() != null ? req.getMarginRate() : 0.0)
                .status(req.getStatus() != null ? req.getStatus() : "LEAD").memo(req.getMemo()).build();
        entity.setNewClientIncentive(NEW_CLIENT_FIXED_AMOUNT);
        entity = clientRepo.save(entity);
        return toClientResponse(entity);
    }

    @Transactional
    public IncentiveDto.ClientPerformanceResponse updateClientPerformance(Long id, IncentiveDto.ClientPerformanceRequest req) {
        ClientPerformance entity = clientRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("ClientPerformance not found: " + id));
        entity.setClientName(req.getClientName()); entity.setAssigneeName(req.getAssigneeName());
        entity.setFirstRegisteredDate(req.getFirstRegisteredDate()); entity.setFirstOrderDate(req.getFirstOrderDate());
        entity.setFirstOrderAmount(nvl(req.getFirstOrderAmount())); entity.setCumulativeSales(nvl(req.getCumulativeSales()));
        entity.setCumulativeOperatingProfit(nvl(req.getCumulativeOperatingProfit()));
        if (req.getMarginRate() != null) entity.setMarginRate(req.getMarginRate());
        entity.setStatus(req.getStatus() != null ? req.getStatus() : entity.getStatus());
        entity.setMemo(req.getMemo());
        entity = clientRepo.save(entity);
        return toClientResponse(entity);
    }

    @Transactional
    public void deleteClientPerformance(Long id) { clientRepo.deleteById(id); }

    @Transactional
    public List<IncentiveDto.IncentiveSummaryResponse> getIncentiveSummary(String month) {
        String targetMonth = resolveMonth(month);
        List<OnlineChannelPerformance> onlineList = onlineRepo.findByPerformanceMonthOrderByChannelNameAsc(targetMonth);
        long totalOnlineProfit = onlineList.stream().filter(o -> Boolean.TRUE.equals(o.getIncentiveEligible()))
                .mapToLong(o -> o.getOperatingProfit() == null ? 0 : o.getOperatingProfit()).sum();
        long pool = calculateOnlinePool(totalOnlineProfit);
        Map<String, Long> onlineIncentiveByAssignee = new HashMap<>();
        if (pool > 0 && totalOnlineProfit > 0) {
            Map<String, Long> assigneeProfit = new HashMap<>();
            for (OnlineChannelPerformance o : onlineList) {
                if (Boolean.TRUE.equals(o.getIncentiveEligible()) && o.getAssigneeName() != null)
                    assigneeProfit.merge(o.getAssigneeName(), o.getOperatingProfit() == null ? 0 : o.getOperatingProfit(), Long::sum);
            }
            for (Map.Entry<String, Long> entry : assigneeProfit.entrySet()) {
                double ratio = (double) entry.getValue() / totalOnlineProfit;
                onlineIncentiveByAssignee.put(entry.getKey(), Math.round(pool * ratio));
            }
        }
        List<ClientPerformance> clientList = clientRepo.findAllByOrderByCreatedAtDesc();
        Map<String, Long> clientIncentiveByAssignee = new HashMap<>();
        for (ClientPerformance c : clientList) {
            if (c.getAssigneeName() != null) {
                double mr = getMarginRate(c);
                long newClientInc = c.getNewClientIncentive() != null ? c.getNewClientIncentive() : NEW_CLIENT_FIXED_AMOUNT;
                long firstOrderInc = calculateFirstOrderIncentive(nvl(c.getFirstOrderAmount()), mr);
                long cumulativeInc = calculateCumulativeSalesIncentive(nvl(c.getCumulativeSales()), mr);
                clientIncentiveByAssignee.merge(c.getAssigneeName(), newClientInc + firstOrderInc + cumulativeInc, Long::sum);
            }
        }
        List<String> allEmployees = new ArrayList<>(onlineIncentiveByAssignee.keySet());
        for (String k : clientIncentiveByAssignee.keySet()) if (!allEmployees.contains(k)) allEmployees.add(k);
        List<IncentiveDto.IncentiveSummaryResponse> result = new ArrayList<>();
        for (String emp : allEmployees) {
            long online = onlineIncentiveByAssignee.getOrDefault(emp, 0L);
            long client = clientIncentiveByAssignee.getOrDefault(emp, 0L);
            IncentiveSummary summary = summaryRepo.findByIncentiveMonthAndEmployeeName(targetMonth, emp).orElse(null);
            if (summary == null) {
                summary = IncentiveSummary.builder().incentiveMonth(targetMonth).employeeName(emp)
                        .onlineIncentive(online).clientIncentive(client).totalIncentive(online + client)
                        .status("EXPECTED").build();
            } else {
                summary.setOnlineIncentive(online); summary.setClientIncentive(client); summary.setTotalIncentive(online + client);
            }
            result.add(toSummaryResponse(summaryRepo.save(summary)));
        }
        return result;
    }

    @Transactional
    public IncentiveDto.IncentiveSummaryResponse updateSummaryStatus(Long id, String status) {
        IncentiveSummary summary = summaryRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("IncentiveSummary not found: " + id));
        summary.setStatus(status);
        return toSummaryResponse(summaryRepo.save(summary));
    }

    @Transactional
    public IncentiveDto.IncentiveKpiResponse getKpi(String month) {
        String targetMonth = resolveMonth(month);
        YearMonth ym = YearMonth.parse(targetMonth);
        LocalDateTime startDt = ym.atDay(1).atStartOfDay();
        LocalDateTime endDt = ym.atEndOfMonth().plusDays(1).atStartOfDay();
        LocalDate startDate = ym.atDay(1);
        LocalDate endDate = ym.atEndOfMonth().plusDays(1);
        long monthlyOnlineSales = onlineRepo.sumSalesByMonth(targetMonth);
        long monthlyOnlineProfit = onlineRepo.sumOperatingProfitByMonth(targetMonth);
        long pool = calculateOnlinePool(monthlyOnlineProfit);
        long newClientCount = clientRepo.countNewClientsByDateRange(startDt, endDt);
        long firstOrderClientCount = clientRepo.countFirstOrderClientsByDateRange(startDate, endDate);
        long clientCumulativeSales = clientRepo.sumAllCumulativeSales();
        List<IncentiveDto.IncentiveSummaryResponse> summaries = getIncentiveSummary(targetMonth);
        long totalExpected = summaries.stream().mapToLong(s -> s.getTotalIncentive() == null ? 0 : s.getTotalIncentive()).sum();
        return IncentiveDto.IncentiveKpiResponse.builder()
                .month(targetMonth).monthlyOnlineSales(monthlyOnlineSales)
                .monthlyOnlineOperatingProfit(monthlyOnlineProfit).onlineIncentivePool(pool)
                .newClientCount(newClientCount).firstOrderClientCount(firstOrderClientCount)
                .clientCumulativeSales(clientCumulativeSales).totalExpectedIncentive(totalExpected).build();
    }

    private String resolveMonth(String month) {
        if (month != null && !month.isBlank()) return month;
        return LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
    }

    private long nvl(Long value) { return value == null ? 0L : value; }

    private double getMarginRate(ClientPerformance c) {
        if (c.getMarginRate() == null || c.getMarginRate() <= 0) return 0.0;
        return c.getMarginRate() / 100.0;
    }

    private long calculateOnlinePool(long totalProfit) {
        if (totalProfit <= ONLINE_THRESHOLD) return 0L;
        return Math.round((totalProfit - ONLINE_THRESHOLD) * ONLINE_POOL_RATE);
    }

    private long calculateFirstOrderIncentive(long firstOrderAmount, double marginRate) {
        if (marginRate <= 0) return 0L;
        long expectedProfit = Math.round(firstOrderAmount * marginRate);
        return Math.round(expectedProfit * FIRST_ORDER_RATE);
    }

    private long calculateCumulativeSalesIncentive(long cumulativeSales, double marginRate) {
        if (marginRate <= 0) return 0L;
        long expectedProfit = Math.round(cumulativeSales * marginRate);
        double rate = getCumulativeRate(cumulativeSales);
        return Math.round(expectedProfit * rate);
    }

    private double getCumulativeRate(long cumulativeSales) {
        if (cumulativeSales >= TIER3_THRESHOLD) return TIER3_RATE;
        if (cumulativeSales >= TIER2_THRESHOLD) return TIER2_RATE;
        return TIER1_RATE;
    }

    private String getTierLabel(long cumulativeSales) {
        if (cumulativeSales >= TIER3_THRESHOLD) return "Tier3 (3%)";
        if (cumulativeSales >= TIER2_THRESHOLD) return "Tier2 (2%)";
        return "Tier1 (1%)";
    }

    private IncentiveDto.OnlinePerformanceResponse toOnlineResponse(OnlineChannelPerformance o, long expectedIncentive) {
        return IncentiveDto.OnlinePerformanceResponse.builder()
                .id(o.getId()).performanceMonth(o.getPerformanceMonth())
                .channelName(o.getChannelName()).assigneeName(o.getAssigneeName())
                .salesAmount(o.getSalesAmount()).manufacturingCost(o.getManufacturingCost())
                .advertisingCost(o.getAdvertisingCost()).commissionCost(o.getCommissionCost())
                .logisticsCost(o.getLogisticsCost()).otherCost(o.getOtherCost())
                .operatingProfit(o.getOperatingProfit()).incentiveEligible(o.getIncentiveEligible())
                .expectedIncentive(expectedIncentive).memo(o.getMemo())
                .createdAt(o.getCreatedAt()).updatedAt(o.getUpdatedAt()).build();
    }

    private IncentiveDto.ClientPerformanceResponse toClientResponse(ClientPerformance c) {
        double marginRate = getMarginRate(c);
        long newClientIncentive = c.getNewClientIncentive() != null ? c.getNewClientIncentive() : NEW_CLIENT_FIXED_AMOUNT;
        long firstOrderIncentive = calculateFirstOrderIncentive(nvl(c.getFirstOrderAmount()), marginRate);
        long cumulativeSalesIncentive = calculateCumulativeSalesIncentive(nvl(c.getCumulativeSales()), marginRate);
        long totalExpected = newClientIncentive + firstOrderIncentive + cumulativeSalesIncentive;
        String tierLabel = getTierLabel(nvl(c.getCumulativeSales()));
        return IncentiveDto.ClientPerformanceResponse.builder()
                .id(c.getId()).clientName(c.getClientName()).assigneeName(c.getAssigneeName())
                .firstRegisteredDate(c.getFirstRegisteredDate()).firstOrderDate(c.getFirstOrderDate())
                .firstOrderAmount(c.getFirstOrderAmount()).cumulativeSales(c.getCumulativeSales())
                .cumulativeOperatingProfit(c.getCumulativeOperatingProfit())
                .marginRate(c.getMarginRate() != null ? c.getMarginRate() : 0.0).tierLabel(tierLabel)
                .status(c.getStatus()).newClientIncentive(newClientIncentive)
                .firstOrderIncentive(firstOrderIncentive).cumulativeSalesIncentive(cumulativeSalesIncentive)
                .totalExpectedIncentive(totalExpected).memo(c.getMemo())
                .createdAt(c.getCreatedAt()).updatedAt(c.getUpdatedAt()).build();
    }

    private IncentiveDto.IncentiveSummaryResponse toSummaryResponse(IncentiveSummary s) {
        return IncentiveDto.IncentiveSummaryResponse.builder()
                .id(s.getId()).incentiveMonth(s.getIncentiveMonth()).employeeName(s.getEmployeeName())
                .onlineIncentive(s.getOnlineIncentive()).clientIncentive(s.getClientIncentive())
                .totalIncentive(s.getTotalIncentive()).status(s.getStatus()).memo(s.getMemo())
                .createdAt(s.getCreatedAt()).updatedAt(s.getUpdatedAt()).build();
    }
            }
