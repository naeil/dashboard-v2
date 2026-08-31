-- V131: AI 고객 인텔리전스 센터 — 목업 리뷰 데이터 제거 (실제 후기 업로드 방식으로 전환)
DELETE FROM ai_review_analyses
WHERE review_id IN (SELECT id FROM ai_reviews WHERE review_id LIKE 'MOCK_%');
DELETE FROM ai_reviews WHERE review_id LIKE 'MOCK_%';
