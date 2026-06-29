-- V111: CS 자동답변 테이블 생성
-- 데이터 흐름: cs_inquiries (원본 수집) -> cs_auto_replies (답변 생성/발송 추적)

-- 1. CS 문의 원본 저장 테이블
CREATE TABLE IF NOT EXISTS cs_inquiries (
      id BIGSERIAL PRIMARY KEY,
      inq_uniq VARCHAR(50) NOT NULL UNIQUE,  -- 플레이오토 문의 고유번호 (idempotency key)
    channel VARCHAR(50),                    -- 스마트스토어, 쿠팡 등
    brand VARCHAR(100),                     -- 하이프리, 국민한상
    inq_type VARCHAR(50),                   -- 상품문의, 상품평, 긴급메세지 등
    shop_sale_no VARCHAR(50),
      shop_sale_name VARCHAR(500),
      shop_ord_no VARCHAR(120),
      inq_id VARCHAR(50),                     -- 문의자 ID
    inq_name VARCHAR(100),                  -- 문의자 이름
    inq_title VARCHAR(300),
      inq_content TEXT,
      rating INTEGER,                         -- 별점 (상품평일 때)
    inq_time TIMESTAMP,
      category VARCHAR(50),                   -- 단순감사/상품문의/배송문의/교환반품/불만클레임/기타
    risk_level VARCHAR(20),                 -- AUTO / QUEUE
    status VARCHAR(30) DEFAULT 'NEW',       -- NEW/REPLIED/PENDING/SENT/REJECTED
    en_send_cs VARCHAR(1),                  -- 답변 전송 가능 여부
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

CREATE INDEX IF NOT EXISTS idx_cs_inquiries_inq_uniq ON cs_inquiries(inq_uniq);
CREATE INDEX IF NOT EXISTS idx_cs_inquiries_status ON cs_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_cs_inquiries_brand ON cs_inquiries(brand);
CREATE INDEX IF NOT EXISTS idx_cs_inquiries_created_at ON cs_inquiries(created_at DESC);

-- 2. CS 자동답변 로그 테이블 (감사 추적)
CREATE TABLE IF NOT EXISTS cs_auto_replies (
      id BIGSERIAL PRIMARY KEY,
      inq_uniq VARCHAR(50) NOT NULL,          -- 플레이오토 문의 고유번호
    inquiry_id BIGINT,                      -- cs_inquiries.id 참조 (소프트 FK)
    channel VARCHAR(50),
      brand VARCHAR(100),
      category VARCHAR(50),                   -- 단순감사/상품문의/배송문의/교환반품/불만클레임/기타
    risk_level VARCHAR(20),                 -- AUTO / QUEUE
    confidence DOUBLE PRECISION,            -- 신뢰도 0.0~1.0
    reply_title VARCHAR(300),
      reply_content TEXT,
      -- 상태: DRAFT/PENDING/AUTO_SENT/MANUALLY_SENT/REJECTED
    status VARCHAR(30) DEFAULT 'DRAFT',
      dry_run BOOLEAN DEFAULT TRUE,           -- 드라이런 모드 여부
    persona_version VARCHAR(50),            -- 사용된 페르소나 버전
    rule_version VARCHAR(50),               -- 사용된 규칙 버전
    sent_at TIMESTAMP,                      -- 실제 발송 시각
    approved_by VARCHAR(100),               -- 승인자 (수동 발송 시)
    approved_at TIMESTAMP,
      playauto_result TEXT,                   -- 플레이오토 API 응답 JSON (감사 로그)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

CREATE INDEX IF NOT EXISTS idx_cs_auto_replies_inq_uniq ON cs_auto_replies(inq_uniq);
CREATE INDEX IF NOT EXISTS idx_cs_auto_replies_status ON cs_auto_replies(status);
CREATE INDEX IF NOT EXISTS idx_cs_auto_replies_brand ON cs_auto_replies(brand);
CREATE INDEX IF NOT EXISTS idx_cs_auto_replies_created_at ON cs_auto_replies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_auto_replies_dry_run ON cs_auto_replies(dry_run);

-- 3. PLAYAUTO 채널 자격증명 (channel_api_credentials 이미 존재, PLAYAUTO 행 삽입)
-- credentialKey1 = x-api-key, credentialKey2 = authentication_key (솔루션 인증키)
INSERT INTO channel_api_credentials (channel_type, is_active, created_at, updated_at)
VALUES ('PLAYAUTO', true, NOW(), NOW())
ON CONFLICT (channel_type) DO NOTHING;
