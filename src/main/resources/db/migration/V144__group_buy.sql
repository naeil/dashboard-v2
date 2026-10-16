-- V144: AI 공동구매 — 공구 셀러(인플루언서·커뮤니티)별 조건 판단(승인·수수료·일정)과 일정별 할 일
CREATE TABLE IF NOT EXISTS group_buy_deal (
    id               BIGSERIAL PRIMARY KEY,
    company_id       BIGINT NOT NULL DEFAULT 1,
    seller_name      VARCHAR(200) NOT NULL,                  -- 셀러·채널명
    channel          VARCHAR(40),                            -- 인스타그램/유튜브/블로그/카페/기타
    contact_email    VARCHAR(200),
    owner_name       VARCHAR(100),                           -- 우리 담당자
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING/APPROVED/HOLD/REJECTED/RUNNING/DONE/CANCELLED
    deal_type        VARCHAR(20),                            -- COMMISSION(수수료형)/CONSIGN(위탁)/BUY(사입)
    commission_rate  NUMERIC(5,2),                           -- 수수료형 수수료율(%)
    sale_price       INTEGER,                                -- 공구 판매가(원)
    products         TEXT,                                   -- 구성
    expected_qty     INTEGER,                                -- 예상 판매 수량
    start_date       DATE,                                   -- 공구 시작
    end_date         DATE,                                   -- 공구 마감
    request_summary  TEXT,                                   -- 셀러 요청 요약(회신 내용)
    memo             TEXT,
    decided_by       VARCHAR(100),
    decided_at       TIMESTAMPTZ,
    related_task_id  BIGINT,
    source           VARCHAR(20) NOT NULL DEFAULT 'MANUAL',  -- MANUAL/AGENT
    source_key       VARCHAR(160),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_buy_source ON group_buy_deal(company_id, source_key) WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_buy_status ON group_buy_deal(company_id, status);

-- 일정별 할 일 (승인하면 시작·마감일 기준으로 자동 생성, 직접 추가·완료 체크 가능)
CREATE TABLE IF NOT EXISTS group_buy_event (
    id          BIGSERIAL PRIMARY KEY,
    deal_id     BIGINT NOT NULL REFERENCES group_buy_deal(id) ON DELETE CASCADE,
    event_date  DATE NOT NULL,
    title       VARCHAR(200) NOT NULL,
    owner_name  VARCHAR(100),
    done        BOOLEAN NOT NULL DEFAULT FALSE,
    done_by     VARCHAR(100),
    auto        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_group_buy_event_date ON group_buy_event(event_date);
CREATE INDEX IF NOT EXISTS idx_group_buy_event_deal ON group_buy_event(deal_id);
