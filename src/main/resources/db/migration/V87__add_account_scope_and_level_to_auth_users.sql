ALTER TABLE dashboard_user
    ADD COLUMN IF NOT EXISTS account_scope VARCHAR(20) NOT NULL DEFAULT 'TENANT';

ALTER TABLE dashboard_user
    ADD COLUMN IF NOT EXISTS account_level VARCHAR(20);

UPDATE dashboard_user
SET account_scope = CASE
        WHEN username = 'admin' AND role = 'EXECUTIVE' THEN 'PLATFORM'
        ELSE 'TENANT'
    END,
    account_level = CASE role
        WHEN 'EXECUTIVE' THEN 'ADMIN'
        WHEN 'MANAGER' THEN 'MANAGER'
        ELSE 'EMPLOYEE'
    END
WHERE account_level IS NULL;

ALTER TABLE dashboard_user
    ALTER COLUMN account_level SET DEFAULT 'EMPLOYEE',
    ALTER COLUMN account_level SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_dashboard_user_account_scope'
    ) THEN
        ALTER TABLE dashboard_user
            ADD CONSTRAINT chk_dashboard_user_account_scope
            CHECK (account_scope IN ('PLATFORM', 'TENANT'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_dashboard_user_account_level'
    ) THEN
        ALTER TABLE dashboard_user
            ADD CONSTRAINT chk_dashboard_user_account_level
            CHECK (account_level IN ('ADMIN', 'MANAGER', 'EMPLOYEE'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dashboard_user_account_scope_level
    ON dashboard_user(account_scope, account_level);

ALTER TABLE dashboard_user_invite
    ADD COLUMN IF NOT EXISTS account_scope VARCHAR(20) NOT NULL DEFAULT 'TENANT';

ALTER TABLE dashboard_user_invite
    ADD COLUMN IF NOT EXISTS account_level VARCHAR(20);

UPDATE dashboard_user_invite
SET account_scope = 'TENANT',
    account_level = CASE role
        WHEN 'EXECUTIVE' THEN 'ADMIN'
        WHEN 'MANAGER' THEN 'MANAGER'
        ELSE 'EMPLOYEE'
    END
WHERE account_level IS NULL;

ALTER TABLE dashboard_user_invite
    ALTER COLUMN account_level SET DEFAULT 'EMPLOYEE',
    ALTER COLUMN account_level SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_dashboard_user_invite_account_scope'
    ) THEN
        ALTER TABLE dashboard_user_invite
            ADD CONSTRAINT chk_dashboard_user_invite_account_scope
            CHECK (account_scope IN ('PLATFORM', 'TENANT'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_dashboard_user_invite_account_level'
    ) THEN
        ALTER TABLE dashboard_user_invite
            ADD CONSTRAINT chk_dashboard_user_invite_account_level
            CHECK (account_level IN ('ADMIN', 'MANAGER', 'EMPLOYEE'));
    END IF;
END $$;
