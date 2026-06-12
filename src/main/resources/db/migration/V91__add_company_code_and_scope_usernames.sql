CREATE OR REPLACE FUNCTION generate_company_code()
RETURNS VARCHAR(5)
LANGUAGE plpgsql
AS $$
DECLARE
    generated_code VARCHAR(5);
BEGIN
    LOOP
        generated_code := (
            SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::int + 1, 1), '')
            FROM generate_series(1, 5)
        );

        IF NOT EXISTS (SELECT 1 FROM company WHERE company_code = generated_code) THEN
            RETURN generated_code;
        END IF;
    END LOOP;
END;
$$;

ALTER TABLE company
    ADD COLUMN IF NOT EXISTS company_code VARCHAR(5);

UPDATE company
SET company_code = generate_company_code()
WHERE company_code IS NULL OR company_code = '';

ALTER TABLE company
    ALTER COLUMN company_code SET NOT NULL,
    ALTER COLUMN company_code SET DEFAULT generate_company_code();

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_company_code
    ON company(company_code);

ALTER TABLE dashboard_user
    DROP CONSTRAINT IF EXISTS dashboard_user_username_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_dashboard_user_company_username'
    ) THEN
        ALTER TABLE dashboard_user
            ADD CONSTRAINT uq_dashboard_user_company_username UNIQUE (company_id, username);
    END IF;
END;
$$;
