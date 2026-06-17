package naeil.dashboard.repository;

import naeil.dashboard.entity.OnlineChannelPerformance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface OnlineChannelPerformanceRepository extends JpaRepository<OnlineChannelPerformance, Long> {

    List<OnlineChannelPerformance> findByPerformanceMonthOrderByChannelNameAsc(String performanceMonth);

    List<OnlineChannelPerformance> findByPerformanceMonthAndChannelName(String performanceMonth, String channelName);

    @Query("SELECT COALESCE(SUM(o.operatingProfit), 0) FROM OnlineChannelPerformance o WHERE o.performanceMonth = :month AND o.incentiveEligible = true")
    Long sumOperatingProfitByMonth(@Param("month") String month);

    @Query("SELECT COALESCE(SUM(o.salesAmount), 0) FROM OnlineChannelPerformance o WHERE o.performanceMonth = :month")
    Long sumSalesByMonth(@Param("month") String month);
}
