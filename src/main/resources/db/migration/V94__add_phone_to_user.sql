-- V94: 비밀번호 찾기를 위한 휴대폰 번호 콜럼 추가
ALTER TABLE dashboard_user ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE dashboard_user_invite ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- SMS OTP 인증 테이블
CREATE TABLE IF NOT EXISTS password_reset_otp (
  id BIGSERIAL PRIMARY KEY,
  company_code VARCHAR(10) NOT NULL,
  login_id VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otp_lookup
  ON password_reset_otp (company_code, login_id, phone_number, used, expires_at);
