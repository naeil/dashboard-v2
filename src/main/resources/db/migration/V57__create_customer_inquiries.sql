CREATE TABLE IF NOT EXISTS executive_customer_inquiry (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    channel VARCHAR(40) NOT NULL,
    external_id VARCHAR(160),
    customer_name VARCHAR(120),
    inquiry_type VARCHAR(80) NOT NULL DEFAULT 'GENERAL',
    message TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'UNANSWERED',
    assigned_to VARCHAR(80),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    urgent BOOLEAN NOT NULL DEFAULT FALSE,
    ai_category VARCHAR(80),
    ai_summary TEXT,
    source_url TEXT,
    raw_payload TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_inquiry_external UNIQUE (company_id, channel, external_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_inquiry_company_status
    ON executive_customer_inquiry(company_id, status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_inquiry_channel
    ON executive_customer_inquiry(company_id, channel, received_at DESC);

INSERT INTO executive_customer_inquiry
    (company_id, channel, external_id, customer_name, inquiry_type, message, status, assigned_to, received_at, urgent, ai_category, ai_summary, source_url)
VALUES
    (1, 'KAKAO', 'sample-kakao-001', '하이프리 고객', '제품 문의', '섭취 방법과 구매 가능한 채널을 문의했습니다.', 'UNANSWERED', '마케팅팀', NOW() - INTERVAL '3 minutes', TRUE, '제품문의', '제품 섭취 방법과 구매 채널 안내가 필요합니다.', 'https://center-pf.kakao.com/'),
    (1, 'SMARTSTORE', 'sample-smartstore-001', '스마트스토어 고객', '배송 문의', '주문 상품의 출고 일정 확인이 필요합니다.', 'IN_PROGRESS', '채널 운영', NOW() - INTERVAL '18 minutes', FALSE, '배송문의', '출고 예정일과 송장 등록 여부 확인이 필요합니다.', 'https://sell.smartstore.naver.com/'),
    (1, 'IMWEB', 'sample-imweb-001', '공식몰 고객', '교환/반품', '제품 수령 후 교환 가능 여부를 문의했습니다.', 'ASSIGNED', 'CS 담당', NOW() - INTERVAL '42 minutes', FALSE, '교환반품', '교환 정책과 접수 절차 안내가 필요합니다.', 'https://admin.imweb.me/')
ON CONFLICT (company_id, channel, external_id) DO NOTHING;
