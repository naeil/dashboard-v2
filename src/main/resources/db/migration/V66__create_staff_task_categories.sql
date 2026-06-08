CREATE TABLE IF NOT EXISTS staff_task_category (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL DEFAULT 1,
    name VARCHAR(80) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#ff5a3d',
    template_project_name VARCHAR(160),
    template_task_name VARCHAR(220),
    template_today_work TEXT,
    template_next_action TEXT,
    template_blocker_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_staff_task_category_company_name UNIQUE (company_id, name)
);

INSERT INTO staff_task_category (
    company_id, name, color, template_project_name, template_task_name,
    template_today_work, template_next_action, template_blocker_text, sort_order, created_by
)
VALUES
    (1, '프로모션', '#ff5a3d', '프로모션 운영', '프로모션 일정 점검',
     '1. 쿠폰/할인 적용 상태 확인 2. 판매가/노출 위치 점검 3. 프로모션 배너 및 상세페이지 문구 확인',
     '마감 전 가격 오류 재확인, 채널별 노출 캡처 공유',
     '상품 승인 지연, 쿠폰 적용 오류, 채널 담당자 확인 필요', 10, 'system'),
    (1, '콘텐츠/상세페이지', '#3b82f6', '콘텐츠 제작', '상세페이지 수정 및 검수',
     '1. 상세페이지 수정 범위 정리 2. 이미지/문구 교체 3. 모바일 화면 검수',
     '디자인 최종본 반영 후 대표 검수 요청',
     '원본 이미지 미수급, 문구 확정 지연', 20, 'system'),
    (1, '재고/출고', '#10b981', '재고 및 출고 관리', '재고/출고 현황 확인',
     '1. 재고 수량 확인 2. 출고 지연 건 체크 3. 품절 위험 SKU 공유',
     '품절 예상 품목 발주 요청, 출고 지연 사유 정리',
     '입고 지연, 송장 누락, 재고 차이 발생', 30, 'system'),
    (1, '광고/마케팅', '#8b5cf6', '광고 운영', '광고 소재 및 성과 점검',
     '1. 광고비/ROAS 확인 2. 소재별 성과 비교 3. 키워드 및 타겟 조정안 작성',
     '성과 낮은 소재 교체, 신규 소재 테스트 일정 등록',
     '광고 승인 지연, 소재 부족, 전환 추적 오류', 40, 'system'),
    (1, '정산/회계', '#f59e0b', '정산/회계', '정산 내역 확인',
     '1. 채널별 정산 금액 확인 2. 미수/미지급 건 정리 3. 증빙 자료 첨부',
     '차액 발생 건 원인 확인, 결재 요청서 작성',
     '세금계산서 누락, 입금 지연, 금액 불일치', 50, 'system')
ON CONFLICT (company_id, name) DO NOTHING;
