CREATE TABLE executive_cash_account (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    bank_name VARCHAR(80) NOT NULL,
    account_name VARCHAR(120) NOT NULL,
    account_number VARCHAR(80),
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    as_of_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE executive_cash_flow (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    flow_date DATE NOT NULL,
    flow_type VARCHAR(20) NOT NULL,
    category VARCHAR(60) NOT NULL,
    counterparty VARCHAR(120),
    amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    memo VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE executive_product_profit (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    product_name VARCHAR(160) NOT NULL,
    sku VARCHAR(80) NOT NULL,
    category VARCHAR(80) NOT NULL,
    production_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    supply_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    platform_fee NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ad_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    logistics_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expected_net_profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    margin_rate NUMERIC(7, 2) NOT NULL DEFAULT 0,
    sold_quantity INTEGER NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    safe_stock INTEGER NOT NULL DEFAULT 0,
    expiry_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE executive_channel_performance (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    channel_name VARCHAR(80) NOT NULL,
    sales_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ad_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    roas NUMERIC(9, 2) NOT NULL DEFAULT 0,
    margin_rate NUMERIC(7, 2) NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    average_order_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    net_profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    report_month DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE executive_receivable (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    partner_name VARCHAR(160) NOT NULL,
    manager_name VARCHAR(80),
    contact VARCHAR(80),
    invoice_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    risk_level VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    memo VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE executive_operating_expense (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    expense_month DATE NOT NULL,
    category VARCHAR(80) NOT NULL,
    expense_type VARCHAR(20) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_date DATE,
    vendor VARCHAR(120),
    memo VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE executive_debt (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    lender VARCHAR(120) NOT NULL,
    loan_name VARCHAR(160) NOT NULL,
    principal_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    interest_rate NUMERIC(7, 3) NOT NULL DEFAULT 0,
    monthly_payment NUMERIC(15, 2) NOT NULL DEFAULT 0,
    next_payment_date DATE NOT NULL,
    maturity_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE executive_export_pipeline (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    country VARCHAR(80) NOT NULL,
    buyer_name VARCHAR(160) NOT NULL,
    stage VARCHAR(60) NOT NULL,
    expected_moq INTEGER NOT NULL DEFAULT 0,
    expected_sales NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expected_payment_date DATE,
    certification_required BOOLEAN NOT NULL DEFAULT FALSE,
    current_status VARCHAR(60) NOT NULL,
    next_action VARCHAR(240),
    owner_name VARCHAR(80),
    memo VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE executive_ad_performance (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    ad_channel VARCHAR(80) NOT NULL,
    ad_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    click_count INTEGER NOT NULL DEFAULT 0,
    cpa NUMERIC(15, 2) NOT NULL DEFAULT 0,
    roas NUMERIC(9, 2) NOT NULL DEFAULT 0,
    conversion_rate NUMERIC(7, 2) NOT NULL DEFAULT 0,
    sales_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    net_profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    report_month DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE executive_issue_log (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    issue_date DATE NOT NULL,
    severity VARCHAR(30) NOT NULL,
    category VARCHAR(80) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(600),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO executive_cash_account (company_id, bank_name, account_name, account_number, balance, as_of_date, status) VALUES
(1, '기업은행', '운영자금 계좌', '123-456789-01-011', 86500000, DATE '2026-05-11', 'NORMAL'),
(1, '국민은행', '광고비 전용 계좌', '777-01-2345-678', 18400000, DATE '2026-05-11', 'WATCH'),
(1, '하나은행', '수출 정산 계좌', '998-910234-11', 32600000, DATE '2026-05-11', 'NORMAL');

INSERT INTO executive_cash_flow (company_id, flow_date, flow_type, category, counterparty, amount, status, memo) VALUES
(1, DATE '2026-05-11', 'INFLOW', 'B2B 납품대금', '헬스앤푸드', 18500000, 'EXPECTED', '단백깡 2차 납품 정산'),
(1, DATE '2026-05-11', 'INFLOW', '온라인 정산', '스마트스토어', 7400000, 'EXPECTED', '주말 주문 정산'),
(1, DATE '2026-05-11', 'OUTFLOW', '광고비', '메타 광고', 3500000, 'SCHEDULED', '5월 2주차 캠페인'),
(1, DATE '2026-05-12', 'OUTFLOW', '생산비', '오송OEM', 22000000, 'SCHEDULED', '프리당 생생효소 생산 착수금'),
(1, DATE '2026-05-14', 'INFLOW', '수출 계약금', 'Saigon Wellness', 41000000, 'EXPECTED', '베트남 초도 MOQ 계약금'),
(1, DATE '2026-05-15', 'OUTFLOW', '급여', '임직원', 38600000, 'SCHEDULED', '5월 급여'),
(1, DATE '2026-05-20', 'OUTFLOW', '세금', '국세청', 12600000, 'SCHEDULED', '부가세 예정 납부'),
(1, DATE '2026-05-24', 'INFLOW', 'B2B 납품대금', '올리브마켓', 29200000, 'EXPECTED', '닭가슴살 정산'),
(1, DATE '2026-05-27', 'OUTFLOW', '대출 상환', '기업은행', 8200000, 'SCHEDULED', '운전자금 원리금'),
(1, DATE '2026-06-03', 'INFLOW', '온라인 정산', '쿠팡', 31800000, 'EXPECTED', '5월 로켓배송 정산'),
(1, DATE '2026-06-05', 'OUTFLOW', '임대료', '나은빌딩', 7200000, 'SCHEDULED', '사무실/창고 임대료');

INSERT INTO executive_product_profit (
    company_id, product_name, sku, category, production_cost, supply_price, selling_price,
    platform_fee, ad_cost, logistics_cost, expected_net_profit, margin_rate,
    sold_quantity, stock_quantity, safe_stock, expiry_date, status
) VALUES
(1, '단백깡', 'PRO-CRUNCH-001', '건강간식', 5200, 8900, 14900, 1100, 1700, 900, 6000, 40.27, 8320, 1840, 1200, DATE '2027-01-20', 'NORMAL'),
(1, '프리당 생생효소', 'ENZYME-FRESH-010', '건강기능식품', 8400, 13900, 23900, 1800, 3100, 1100, 9500, 39.75, 5120, 780, 1000, DATE '2026-11-12', 'LOW_STOCK'),
(1, '닭가슴살', 'CHICKEN-LEAN-020', '냉동식품', 3100, 5200, 7900, 680, 900, 1450, 1770, 22.41, 11800, 6200, 2500, DATE '2026-08-05', 'NORMAL'),
(1, '비타민', 'VITAMIN-DAILY-030', '건강기능식품', 6900, 10500, 17900, 1300, 2600, 900, 6200, 34.64, 2860, 4300, 1200, DATE '2027-03-18', 'OVER_STOCK'),
(1, '기타 SKU', 'ETC-BUNDLE-999', '세트상품', 9700, 14000, 19900, 1500, 2200, 1200, 5300, 26.63, 1420, 360, 500, DATE '2026-09-30', 'LOW_MARGIN');

INSERT INTO executive_channel_performance (
    company_id, channel_name, sales_amount, ad_cost, roas, margin_rate,
    order_count, average_order_value, net_profit, report_month
) VALUES
(1, '스마트스토어', 148600000, 15600000, 952.56, 34.20, 5840, 25445, 50800000, DATE '2026-05-01'),
(1, '자사몰', 86400000, 9200000, 939.13, 38.70, 2380, 36303, 33400000, DATE '2026-05-01'),
(1, '쿠팡', 132500000, 18800000, 704.79, 25.90, 4920, 26931, 34300000, DATE '2026-05-01'),
(1, '오프라인', 74200000, 1200000, 6183.33, 31.40, 610, 121639, 23300000, DATE '2026-05-01'),
(1, '수출', 118000000, 3800000, 3105.26, 42.60, 8, 14750000, 50200000, DATE '2026-05-01'),
(1, 'B2B 납품', 96500000, 900000, 10722.22, 29.80, 34, 2838235, 28700000, DATE '2026-05-01');

INSERT INTO executive_receivable (
    company_id, partner_name, manager_name, contact, invoice_amount, paid_amount,
    due_date, status, risk_level, memo
) VALUES
(1, '헬스앤푸드', '김지훈', '010-2355-1177', 42000000, 23500000, DATE '2026-05-10', 'OVERDUE', 'WATCH', '잔금 입금 확인 필요'),
(1, '올리브마켓', '박소영', '010-7788-2301', 29200000, 0, DATE '2026-05-24', 'EXPECTED', 'NORMAL', '정상 결제 예정'),
(1, 'Saigon Wellness', 'Nguyen Linh', '+84-90-112-3344', 82000000, 41000000, DATE '2026-05-18', 'PARTIAL', 'NORMAL', '수출 계약금 수령 완료'),
(1, '북경그린푸드', '왕리', '+86-10-5512-9001', 56000000, 0, DATE '2026-04-30', 'OVERDUE', 'HIGH', '통관 서류 이슈로 지연'),
(1, '제주리테일', '오민재', '010-9001-4422', 11800000, 2000000, DATE '2026-04-21', 'OVERDUE', 'CRITICAL', '회수 일정 재협의 필요');

INSERT INTO executive_operating_expense (company_id, expense_month, category, expense_type, amount, payment_date, vendor, memo) VALUES
(1, DATE '2026-05-01', '인건비', 'FIXED', 38600000, DATE '2026-05-15', '임직원', '급여'),
(1, DATE '2026-05-01', '4대보험', 'FIXED', 7200000, DATE '2026-05-10', '공단', '사업주 부담분'),
(1, DATE '2026-05-01', '임대료', 'FIXED', 7200000, DATE '2026-05-05', '나은빌딩', '사무실/창고'),
(1, DATE '2026-05-01', '차량 유지비', 'FIXED', 2300000, DATE '2026-05-20', '현대캐피탈', '영업 차량'),
(1, DATE '2026-05-01', '식대', 'VARIABLE', 1800000, DATE '2026-05-25', '복지몰', '임직원 식대'),
(1, DATE '2026-05-01', '통신비', 'FIXED', 850000, DATE '2026-05-18', 'KT', '통신/인터넷'),
(1, DATE '2026-05-01', '렌탈비', 'FIXED', 1450000, DATE '2026-05-12', '렌탈코리아', '정수기/복합기'),
(1, DATE '2026-05-01', '광고비', 'VARIABLE', 47400000, DATE '2026-05-31', '광고 플랫폼', '월 광고 집행'),
(1, DATE '2026-05-01', '물류비', 'VARIABLE', 18400000, DATE '2026-05-28', 'CJ대한통운', '택배/3PL'),
(1, DATE '2026-05-01', '외주비', 'VARIABLE', 6800000, DATE '2026-05-22', '브랜드스튜디오', '콘텐츠 제작'),
(1, DATE '2026-05-01', '생산비', 'VARIABLE', 96000000, DATE '2026-05-12', '오송OEM', '제품 생산'),
(1, DATE '2026-05-01', '기타 비용', 'VARIABLE', 2400000, DATE '2026-05-30', '기타', '소모품');

INSERT INTO executive_debt (
    company_id, lender, loan_name, principal_balance, interest_rate,
    monthly_payment, next_payment_date, maturity_date, status
) VALUES
(1, '기업은행', '운전자금 대출', 280000000, 4.850, 8200000, DATE '2026-05-27', DATE '2028-05-27', 'NORMAL'),
(1, '신용보증기금', '보증 연계 시설자금', 145000000, 3.950, 5100000, DATE '2026-06-03', DATE '2029-06-03', 'NORMAL'),
(1, '국민은행', '광고비 한도대출', 68000000, 5.250, 2400000, DATE '2026-05-25', DATE '2027-12-25', 'WATCH');

INSERT INTO executive_export_pipeline (
    company_id, country, buyer_name, stage, expected_moq, expected_sales,
    expected_payment_date, certification_required, current_status, next_action, owner_name, memo
) VALUES
(1, '베트남', 'Saigon Wellness', '계약 진행', 12000, 164000000, DATE '2026-05-18', FALSE, '계약서 검토 중', '선적 조건 확정', '이현우', '단백깡/효소 복합 발주'),
(1, '일본', 'Tokyo Bio Retail', '테스트 진행', 5000, 72000000, DATE '2026-06-20', TRUE, '성분표 번역 검토', '일본 표시사항 확인', '김민서', '비타민 SKU 관심'),
(1, '중국', 'Beijing Green Food', '협상 중', 18000, 236000000, DATE '2026-07-05', TRUE, '통관 인증 확인 필요', '위생허가 대행 견적', '이현우', '결제 조건 보수적으로 관리'),
(1, '미국', 'LA K-Fit Market', '샘플 발송', 8000, 118000000, DATE '2026-07-20', TRUE, '샘플 도착 대기', 'FDA 라벨 검토', '박지연', '닭가슴살 냉동 유통 문의'),
(1, '싱가포르', 'Lion Health Hub', '리드 확보', 3000, 46000000, DATE '2026-08-10', FALSE, '초기 미팅 완료', '가격표 송부', '김민서', '소량 테스트 가능성 높음');

INSERT INTO executive_ad_performance (
    company_id, ad_channel, ad_cost, click_count, cpa, roas,
    conversion_rate, sales_amount, net_profit, report_month
) VALUES
(1, '메타 광고', 18600000, 84200, 11800, 486.50, 3.70, 90490000, 21800000, DATE '2026-05-01'),
(1, '네이버 광고', 14200000, 51200, 9600, 552.30, 4.10, 78430000, 22600000, DATE '2026-05-01'),
(1, '구글 광고', 9200000, 28700, 13400, 398.20, 2.80, 36630000, 7200000, DATE '2026-05-01'),
(1, '틱톡 광고', 5400000, 43300, 8200, 331.70, 2.30, 17910000, 2600000, DATE '2026-05-01');

INSERT INTO executive_issue_log (company_id, issue_date, severity, category, title, description, status) VALUES
(1, DATE '2026-05-11', 'HIGH', '현금흐름', '5월 15일 급여 전 현금 여유 7.8일', '수출 계약금 입금이 지연되면 광고비 집행 축소 필요', 'OPEN'),
(1, DATE '2026-05-11', 'CRITICAL', '미수금', '제주리테일 미수금 980만원 20일 이상 연체', '대표 명의 회수 콜 또는 출고 제한 검토 필요', 'OPEN'),
(1, DATE '2026-05-10', 'MEDIUM', '재고', '프리당 생생효소 안전재고 미달', '다음 생산 발주를 5월 12일 이전 확정 권장', 'OPEN'),
(1, DATE '2026-05-09', 'MEDIUM', '광고', '틱톡 광고 ROAS 목표 미달', '전환 소재 2종 중단 후 네이버 예산 재배분 검토', 'IN_PROGRESS'),
(1, DATE '2026-05-08', 'LOW', '수출', '일본 라벨 인증 검토 필요', '6월 테스트 물량 출고 전 표시사항 확인 필요', 'OPEN');
