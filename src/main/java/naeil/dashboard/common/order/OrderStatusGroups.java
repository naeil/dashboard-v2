package naeil.dashboard.common.order;

import java.util.List;
import java.util.Set;

public final class OrderStatusGroups {

    public static final String STATUS_CANCELLED_INTERNAL = "주문취소";

    private static final Set<String> COMPLETED_REVERSAL_STATUSES = Set.of(
            "취소완료",
            "반품완료",
            "교환완료",
            "맞교환완료",
            STATUS_CANCELLED_INTERNAL
    );

    private static final Set<String> REVENUE_INCLUDED_STATUS_SET = Set.of(
            "결제완료",
            "신규주문",
            "출고대기",
            "출고보류",
            "운송장출력",
            "출고완료",
            "배송중",
            "배송완료",
            "구매결정",
            "취소요청",
            "반품요청",
            "반품접수",
            "반품회수완료",
            "교환요청",
            "교환접수",
            "교환회수완료",
            "맞교환요청",
            "주문재확인",
            "주문보류",
            "판매완료"
    );

    public static final List<String> REVENUE_INCLUDED_STATUSES = REVENUE_INCLUDED_STATUS_SET.stream()
            .sorted()
            .toList();

    private OrderStatusGroups() {
    }

    public static boolean isRevenueIncludedStatus(String status) {
        return status != null && REVENUE_INCLUDED_STATUS_SET.contains(status.trim());
    }

    public static boolean isCompletedReversalStatus(String status) {
        return status != null && COMPLETED_REVERSAL_STATUSES.contains(status.trim());
    }
}
