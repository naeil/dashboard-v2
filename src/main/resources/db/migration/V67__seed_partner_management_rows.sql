WITH rows (
    partner_name, partner_type_label, business_scope, manager_name,
    owner_name, contact, tax_email, settlement_terms
) AS (
    VALUES
    ('수아인터내셔날', '위탁벤더사', '당근효소,프리아닭', '이영수대표님', NULL, '010-4330-4521', 'lee0su@naver.com', NULL),
    ('브와브', '바이럴', '바이럴(구매리뷰)', '김경민대표님', NULL, '010-5741-9433', 'gnosisteompo@gmail.com', NULL),
    ('㈜아미푸드', '제조사', '국민한상', '이하경이사님', NULL, '010-5661-1153', NULL, NULL),
    ('제이에프앤비', '제조사', '프리아닭', '김대준 팀장님', NULL, '010-2666-5730', 'monkeycrap@naver.com', NULL),
    ('농업법인 유선식품 주식회사', '파트너사', '프리아닭,국민한상', '김지선차장님', NULL, '010-4171-2344', 'ysfood11@naver.com', NULL),
    ('농업법인 유선식품 주식회사', '파트너사', '프리아닭,국민한상', '유선국대표님', NULL, '010-4543-4478', NULL, NULL),
    ('유한회사 에스지로지스', '물류사', '3pl물류', NULL, NULL, '010-8598-0059', 'J85980059@nate.com', NULL),
    ('㈜천안물류', '물류사', '보관창고', '이장주대리님', NULL, '010-5333-5585', 'qwqw5585@calogis.co.kr', NULL),
    ('㈜천안물류', '물류사', '보관창고', '정대용센터장', NULL, '010-9224-8001', 'jdw8001@calogis.co.kr', NULL),
    ('주식회사 청담플러스', '물류사', '상온,냉동탑차', '민홍기대표님', NULL, '010-6395-0019', NULL, NULL),
    ('에스앤씨인터내셔널', '유통사', '서울우유 발주', NULL, NULL, NULL, NULL, NULL),
    ('꿈다', '바이럴', '카페바이럴', '최상진대표님', NULL, '010-2287-1340', 'tkdwlswkd13@naver.com', NULL),
    ('㈜위드밀', '유통사', '군납벤더사', '조현대리님', NULL, '010-3356-3778', 'water4149@naver.com', NULL),
    ('㈜위드밀', '유통사', '군납벤더사', '이수아대표님', NULL, '010-2047-3606', 'water4149@naver.com', NULL),
    ('㈜신우상사', '제조사', '단백깡 필름지 생산', '박철우대표님', NULL, '010-3115-3099', NULL, NULL),
    ('㈜라인', '제조사', '단백깡 필름지 동판업체', '원유정 대표님', NULL, '010-6344-5630', 'zanuni@naver.com', NULL),
    ('㈜비아이에프', '제조사', '단백깡 시즈닝', '윤승택 부장님', NULL, '010-9395-6223', 'styoon@bifkorea.co.kr', NULL),
    ('티티코퍼레이션', '제조사', '돈까스', '김해빛차이사님', NULL, '010-6369-2425', 'chan00100@naver.com', NULL),
    ('㈜오림코퍼레이션', '브랜드사', '다이어트학교 브랜드사', '문주은 MD', NULL, '010-5920-4992', 'byediet@naver.com', NULL),
    ('㈜푸드나무', '브랜드사', '랭킹닭컴', '김예진MD', NULL, '010-5657-5917', 'kyj78421@foodnamoo.com', NULL),
    ('한국식품클러스터', '정부지원', '익산정부지원', '황소정대리님', NULL, '063-720-0621', 'hsj123@foodpolis.kr', NULL),
    ('코트라 수출위원장', '정부지원', '코트라정부지원', '유희길위원장님', NULL, '010-6212-8908', 'heegil@kotra.or.kr', NULL),
    ('천안관세법인', '특허,법률', '수출신고필증관세사', '유한나 관세사', NULL, '010-8844-7639', 'hny0409@cacustoms.co.kr', NULL),
    ('NIPC국제특허', '특허,법률', '단백깡 제조특허', '이정헌 변리사', NULL, '010-2961-1814', 'lee@nipc.co.kr', NULL),
    ('제로스토어', '유통사', '제로스토어', '김민찬 이사님', NULL, '010-7469-3631', 'bbelldum@zerostore.kr', NULL),
    ('㈜부흥사다이어리', '파트너사', '부흥사다이어리', '서일아 이사님', NULL, '010-7162-7986', 'boo8822@hanmail.net', NULL),
    ('㈜부흥사다이어리', '파트너사', '부흥사다이어리', '백종현 대표님', NULL, '010-3232-7996', 'sjpapa1009@gmail.com', NULL),
    ('경기도일자리재단', '정부지원', '새일턴여성지원사업', '윤미애 전임', NULL, '031-270-9806', 'dayun99@gif.or.kr', NULL),
    ('경기도일자리재단', '정부지원', '새일턴여성지원사업', '고유리 전임', NULL, '031-270-9811', 'eatth4961@gif.or.kr', NULL),
    ('상상푸드시스템', '제조사', '과자 시즈닝 업체', '조효득 차장님', NULL, '010-9998-7035', NULL, NULL),
    ('중소기업벤처부비지니스단', '정부지원', '카카오정부지원사업컨설턴트', '홍한표컨설턴트', NULL, '010-5369-4826', 'hhp1520@hanmail.net', NULL),
    ('㈜미양식품', '파트너사', '컨설팅 파트너', '문현일 실장님', NULL, '010-9075-6455', 'bawimoon@naver.com', NULL),
    ('위드그린', '브랜드사', '케이첩사라다', '송형태 마케팅팀 팀장님', NULL, '010-8331-2086', 'sht4353@nate.com', NULL),
    ('㈜ 씨앤미', '제조사', '단백깡 제조사', '이찬우 대표님', NULL, '010-2583-4005', 'cnme4005@naver.com', NULL),
    ('㈜청호씨푸드', '제조사', '펫푸드 제조사/신우상사 소개건', '김영현 공장장님', NULL, '010-3854-7779', 'kyhh1989@daum.net', NULL),
    ('이마트트레이더스 밴더사', '유통사', '이마트트레이더스 밴더사', '이재광이사님', NULL, '010-3610-3992', 'ljksuk@hanmail.net', NULL),
    ('스포츠바이오텍', '제조사', '프로틴볼 구매처', '박기남이사님', NULL, '010-4769-3081', 'sbt@sportsbiotec.com', NULL),
    ('뉴트리플래닛', '제조사', '당근효소 제조사', '정소용 주임님', NULL, '010-8139-1713', NULL, NULL),
    ('뉴트리플래닛', '제조사', '당근효소 제조사', '최형원 주임님', NULL, '010 8593 3616', 'hwchoi@nutriplanet.co.kr', NULL),
    ('와이즈아크', '특허,법률', '기업부설연구소컨설팅사', '전승세대표님', NULL, '010-8496-3187', 'worldchon@gmail.com', NULL),
    ('엑심플러스', '유통사', '폐쇄몰 벤더사', '정유권대표님', NULL, '010-8380-6501', NULL, NULL),
    ('다온국제특허법률사무소', '특허,법률', '상표출원', '강현석 과장님', NULL, '010-5941-1822', 'daon@daonpat.com', NULL)
)
INSERT INTO executive_receivable (
    company_id, partner_name, manager_name, contact, invoice_amount, paid_amount,
    due_date, status, risk_level, memo, partner_type, business_scope, owner_name,
    tax_email, settlement_terms, contract_status
)
SELECT
    1,
    r.partner_name,
    r.manager_name,
    r.contact,
    0,
    0,
    CURRENT_DATE,
    'DONE',
    'NORMAL',
    '초기 거래처 목록 등록',
    CASE r.partner_type_label
        WHEN '제조사' THEN 'PRODUCTION'
        WHEN '물류사' THEN 'LOGISTICS'
        WHEN '바이럴' THEN 'MARKETING'
        WHEN '브랜드사' THEN 'MARKETING'
        WHEN '유통사' THEN 'SALES'
        WHEN '위탁벤더사' THEN 'SALES'
        ELSE 'ETC'
    END,
    r.business_scope,
    r.owner_name,
    r.tax_email,
    r.settlement_terms,
    'ACTIVE'
FROM rows r
WHERE NOT EXISTS (
    SELECT 1
    FROM executive_receivable e
    WHERE e.company_id = 1
      AND e.partner_name = r.partner_name
      AND COALESCE(e.manager_name, '') = COALESCE(r.manager_name, '')
      AND COALESCE(e.contact, '') = COALESCE(r.contact, '')
);
