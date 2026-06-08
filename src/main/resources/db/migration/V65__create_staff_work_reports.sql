CREATE TABLE IF NOT EXISTS staff_work_report (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    username VARCHAR(80) NOT NULL,
    display_name VARCHAR(120),
    report_type VARCHAR(20) NOT NULL DEFAULT 'DAILY',
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    week_start_date DATE,
    title VARCHAR(180) NOT NULL,
    completed_work TEXT,
    planned_work TEXT,
    blockers TEXT,
    memo TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_work_report_user_date
    ON staff_work_report(company_id, username, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_staff_work_report_type
    ON staff_work_report(company_id, report_type, report_date DESC);
