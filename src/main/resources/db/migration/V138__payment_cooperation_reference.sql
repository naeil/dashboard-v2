-- V138: 지출결의 결재선에 협조자(검토·의견, 비차단)·참조자(통보만) 추가
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS cooperator_usernames VARCHAR(600);
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS cooperator_names     VARCHAR(600);
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS referrer_usernames   VARCHAR(600);
ALTER TABLE executive_payment_request ADD COLUMN IF NOT EXISTS referrer_names       VARCHAR(600);
-- payment_approval_step.action 에 'COOPERATE'(협조 의견) 추가 사용. step_no=0 으로 기록.
