-- V139: 인사담당자(HR_MANAGER) 역할 + 직원 인사 필드
-- role CHECK 제약에 HR_MANAGER 추가
ALTER TABLE dashboard_user DROP CONSTRAINT IF EXISTS chk_dashboard_user_role;
ALTER TABLE dashboard_user ADD CONSTRAINT chk_dashboard_user_role
    CHECK (role IN ('EMPLOYEE', 'MANAGER', 'EXECUTIVE', 'HR_MANAGER'));

ALTER TABLE dashboard_user_invite DROP CONSTRAINT IF EXISTS chk_dashboard_user_invite_role;
ALTER TABLE dashboard_user_invite ADD CONSTRAINT chk_dashboard_user_invite_role
    CHECK (role IN ('EMPLOYEE', 'MANAGER', 'EXECUTIVE', 'HR_MANAGER'));

-- 인사카드 필드
ALTER TABLE dashboard_user ADD COLUMN IF NOT EXISTS hire_date         DATE;
ALTER TABLE dashboard_user ADD COLUMN IF NOT EXISTS birth_date        DATE;
ALTER TABLE dashboard_user ADD COLUMN IF NOT EXISTS address           VARCHAR(300);
ALTER TABLE dashboard_user ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(120);
ALTER TABLE dashboard_user ADD COLUMN IF NOT EXISTS employment_type   VARCHAR(40);   -- 정규직/계약직/파트타임 등
ALTER TABLE dashboard_user ADD COLUMN IF NOT EXISTS base_salary       BIGINT;
ALTER TABLE dashboard_user ADD COLUMN IF NOT EXISTS bank_name         VARCHAR(60);
ALTER TABLE dashboard_user ADD COLUMN IF NOT EXISTS bank_account      VARCHAR(80);
ALTER TABLE dashboard_user ADD COLUMN IF NOT EXISTS resident_number   VARCHAR(20);   -- 주민번호(민감) — API는 마스킹 반환
ALTER TABLE dashboard_user ADD COLUMN IF NOT EXISTS annual_leave_total   NUMERIC(5,1) NOT NULL DEFAULT 15; -- 연차 부여일수
ALTER TABLE dashboard_user ADD COLUMN IF NOT EXISTS hr_memo           TEXT;
