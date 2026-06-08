CREATE TABLE IF NOT EXISTS staff_attendance_record (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    username VARCHAR(120) NOT NULL,
    display_name VARCHAR(120),
    work_date DATE NOT NULL,
    clock_in_at TIMESTAMPTZ,
    clock_out_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'READY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_staff_attendance_record_day UNIQUE (company_id, username, work_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_record_month
    ON staff_attendance_record(company_id, work_date, username);
