package naeil.dashboard.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import naeil.dashboard.dto.AuthUser;
import naeil.dashboard.dto.PromotionHistoryDTO;
import naeil.dashboard.dto.PromotionMarginFormDTO;
import naeil.dashboard.service.AuthService;
import naeil.dashboard.service.PromotionMarginService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 프로모션 마진 API
   *
   * [서식 저장 흐름]
   *  POST /api/promotion-margin/forms              → 서식 임시저장(draft)
   *  POST /api/promotion-margin/forms/{id}/submit  → 서식 제출 + 프로모션 내역 자동 연동
   *
   * [프로모션 내역 조회 - 채널별]
   *  GET  /api/promotion-margin/history                      → 전체
   *  GET  /api/promotion-margin/history?channel=online       → 온라인
   *  GET  /api/promotion-margin/history?channel=offline      → 오프라인
   *  GET  /api/promotion-margin/history?channel=export       → 해외
   *
   * [실적 갱신]
   *  PUT  /api/promotion-margin/history/{id}/actuals  → 실시간 매출/영업이익 갱신
   */
@RestController
  @RequestMapping("/api/promotion-margin")
  @RequiredArgsConstructor
  public class PromotionMarginController {

    private final PromotionMarginService promotionMarginService;

    // ─────────────────────────────────────────────────────────────────────────
    // 서식 저장 (draft)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 직원이 "서식 저장" 클릭 시 호출
     * → promotion_margin_form 테이블에 status=draft 로 저장
       */
    @PostMapping("/forms")
        public ResponseEntity<Map<String, Object>> saveForm(
                  @RequestBody PromotionMarginFormDTO.Request request,
                  HttpServletRequest httpRequest
              ) {
                  String username = getUsername(httpRequest);
                  Long formId = promotionMarginService.saveForm(request, username);
                  return ResponseEntity.ok(Map.of(
                                "formId",  formId,
                                "message", "서식이 임시저장되었습니다."
                            ));
        }

    /**
     * 직원이 하단 "서식 저장(제출)" 클릭 시 호출
     * → status=submitted 변경 + promotion_history 자동 생성(프로모션 내역 연동)
       */
    @PostMapping("/forms/{formId}/submit")
        public ResponseEntity<Map<String, Object>> submitForm(
                  @PathVariable Long formId,
                  @RequestParam(defaultValue = "1") Long companyId,
                  HttpServletRequest httpRequest
              ) {
                  String username = getUsername(httpRequest);
                  Long historyId = promotionMarginService.submitForm(formId, companyId, username);
                  return ResponseEntity.ok(Map.of(
                                "formId",    formId,
                                "historyId", historyId,
                                "message",   "서식이 제출되어 프로모션 내역에 등록되었습니다."
                            ));
        }

    /**
     * 서식 목록 조회 (채널 필터 선택 가능)
       */
    @GetMapping("/forms")
        public ResponseEntity<List<PromotionMarginFormDTO.Response>> getForms(
                  @RequestParam(defaultValue = "1") Long companyId,
                  @RequestParam(required = false)   String channel
              ) {
                  return ResponseEntity.ok(promotionMarginService.getForms(companyId, channel));
        }

    // ─────────────────────────────────────────────────────────────────────────
    // 프로모션 내역 조회 (채널별: online / offline / export)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 채널별 프로모션 신청 내역
     * - channel 파라미터 없으면 전체 채널 반환 (online/offline/export 각각 집계)
       * - 각 항목에 목표 매출, 실시간 매출, 실시간 영업이익, 달성률 포함
       */
      @GetMapping("/history")
      public ResponseEntity<List<PromotionHistoryDTO.ChannelSummary>> getHistory(
          @RequestParam(defaultValue = "1") Long companyId,
          @RequestParam(required = false)   String channel
      ) {
          return ResponseEntity.ok(promotionMarginService.getHistory(companyId, channel));
}

    // ─────────────────────────────────────────────────────────────────────────
    // 실시간 실적 업데이트
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 실시간 매출 / 영업이익 갱신
           * DB GENERATED 컬럼(actual_operating_profit, revenue_achievement_rate) 자동 재계산
           */
          @PutMapping("/history/{id}/actuals")
          public ResponseEntity<Map<String, Object>> updateActuals(
              @PathVariable Long id,
              @RequestBody PromotionHistoryDTO.ActualUpdateRequest request
          ) {
              request.setId(id);
              promotionMarginService.updateActuals(request);
              return ResponseEntity.ok(Map.of(
                            "id",      id,
                            "message", "실시간 실적이 업데이트되었습니다."
                        ));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper - 기존 컨트롤러 패턴과 동일하게 session attribute 에서 username 추출
    // ─────────────────────────────────────────────────────────────────────────
    private String getUsername(HttpServletRequest request) {
              AuthUser user = (AuthUser) request.getAttribute(AuthService.AUTHENTICATED_USER_ATTR);
              return user != null ? user.username() : "unknown";
    }
}
