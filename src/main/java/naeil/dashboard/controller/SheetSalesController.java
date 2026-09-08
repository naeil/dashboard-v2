package naeil.dashboard.controller;

import java.time.LocalDate;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.service.SheetSalesPullService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 구글시트 매출 수동 수집 엔드포인트 (/api/executive 하위 → 대표 권한).
 * 스케줄러 없이 이 엔드포인트 호출 시에만 실행된다.
 */
@RestController
@RequestMapping("/api/executive/sheet-sales")
@RequiredArgsConstructor
public class SheetSalesController {

    private final SheetSalesPullService sheetSalesPullService;

    /**
     * @param companyId     회사 ID (기본 1)
     * @param sheetId       시트 ID 또는 URL (미지정 시 기본 시트)
     * @param fromDate      이 날짜 이상만 수집 (미지정 시 전체)
     * @param purgeNonSheet true 면 PlayAuto 등 비시트 주문도 삭제하고 시트를 단일 원본으로 사용
     */
    @PostMapping("/pull")
    public ResponseEntity<Map<String, Object>> pull(
            @RequestParam(defaultValue = "1") Long companyId,
            @RequestParam(required = false) String sheetId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(defaultValue = "false") boolean purgeNonSheet) {
        return ResponseEntity.ok(sheetSalesPullService.pull(companyId, sheetId, fromDate, purgeNonSheet));
    }
}
