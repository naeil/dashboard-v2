ALTER TABLE executive_channel_credential
    ADD COLUMN IF NOT EXISTS category_name VARCHAR(160),
    ADD COLUMN IF NOT EXISTS account_type VARCHAR(160),
    ADD COLUMN IF NOT EXISTS password_change_note VARCHAR(120),
    ADD COLUMN IF NOT EXISTS review_username VARCHAR(255),
    ADD COLUMN IF NOT EXISTS review_password_cipher TEXT;

CREATE INDEX IF NOT EXISTS idx_executive_channel_credential_category
    ON executive_channel_credential(company_id, category_name, account_type);
