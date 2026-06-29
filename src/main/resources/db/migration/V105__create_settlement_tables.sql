-- V105: Settlement schedule rules and expected items tables
CREATE TABLE IF NOT EXISTS settlement_schedule_rules (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL DEFAULT 1,
  channel_name VARCHAR(100) NOT NULL,
  settlement_type VARCHAR(20) NOT NULL DEFAULT 'B2C',
  base_date_type VARCHAR(60) NOT NULL DEFAULT '구매확정일',
  cycle_type VARCHAR(20) NOT NULL DEFAULT 'D+N',
  cycle_value VARCHAR(20) NOT NULL DEFAULT '1',
  fee_rate NUMERIC(7,3) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  currency VARCHAR(10) NOT NULL DEFAULT 'KRW',
  memo VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settlement_expected_items (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL DEFAULT 1,
  vendor_name VARCHAR(160) NOT NULL,
  settlement_type VARCHAR(20) NOT NULL DEFAULT 'B2C',
  channel_name VARCHAR(100),
  brand_name VARCHAR(120),
  order_id VARCHAR(100),
  sales_date DATE,
  payment_date DATE,
  delivery_completed_date DATE,
  purchase_confirmed_date DATE,
  gross_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
  cancel_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  return_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  shipping_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
  platform_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
  ad_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(15,2) NOT NULL DEFAULT 0,
  expected_settlement_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  expected_deposit_date DATE,
  actual_deposit_amount NUMERIC(15,2),
  actual_deposit_date DATE,
  settlement_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  manager VARCHAR(80),
  memo VARCHAR(500),
  currency VARCHAR(10) NOT NULL DEFAULT 'KRW',
  country VARCHAR(10) NOT NULL DEFAULT 'KR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO settlement_schedule_rules (company_id, channel_name, settlement_type, base_date_type, cycle_type, cycle_value, fee_rate, currency, memo) VALUES
(1, '스마트스토어', 'B2C', '구매확정일', 'D+N', '1', 3.63, 'KRW', '네이버 스마트스토어 일반 정산'),
(1, '스마트스토어(빠른정산)', 'B2C', '집화일', 'D+N', '1', 5.5, 'KRW', '빠른 정산 서비스'),
(1, '쿠팡(주정산)', 'B2C', '구매확정일', 'WEEKLY', '2', 10.8, 'KRW', '쿠팡 주정산 - 매주 화요일'),
(1, '쿠팡(월정산)', 'B2C', '구매확정일', 'MONTHLY', '15', 10.8, 'KRW', '쿠팡 월정산 - 익월 15일'),
(1, '카카오', 'B2C', '결제일', 'D+N', '3', 3.5, 'KRW', '카카오쇼핑 결제일+3일'),
(1, '자사몰', 'B2C', '결제일', 'D+N', '3', 0, 'KRW', '자사몰 PG사 정산'),
(1, '오프라인', 'B2B', '세금계산서 발행일', 'D+N', '30', 0, 'KRW', 'B2B 오프라인 정산')
ON CONFLICT DO NOTHING;
