CREATE TABLE payroll_record (
    id                              BIGSERIAL     PRIMARY KEY,
    company_id                      BIGINT        NOT NULL REFERENCES company(id),
    pay_year_month                  VARCHAR(7)    NOT NULL,         -- e.g. '2026-05'
    employee_name                   VARCHAR(80)   NOT NULL,
    user_id                         BIGINT        REFERENCES dashboard_user(id),
    base_salary                     NUMERIC(15,2) NOT NULL DEFAULT 0,
    meal_allowance                  NUMERIC(15,2) NOT NULL DEFAULT 0,
    transport_allowance             NUMERIC(15,2) NOT NULL DEFAULT 0,
    other_allowance                 NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_payment                   NUMERIC(15,2) NOT NULL DEFAULT 0,
    deduction_national_pension      NUMERIC(15,2) NOT NULL DEFAULT 0,
    deduction_health_insurance      NUMERIC(15,2) NOT NULL DEFAULT 0,
    deduction_long_term_care        NUMERIC(15,2) NOT NULL DEFAULT 0,
    deduction_employment_insurance  NUMERIC(15,2) NOT NULL DEFAULT 0,
    deduction_income_tax            NUMERIC(15,2) NOT NULL DEFAULT 0,
    deduction_local_income_tax      NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_deduction                 NUMERIC(15,2) NOT NULL DEFAULT 0,
    net_pay                         NUMERIC(15,2) NOT NULL DEFAULT 0,
    email_sent_at                   TIMESTAMPTZ,
    created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_payroll_employee_month UNIQUE (company_id, pay_year_month, employee_name)
);

CREATE INDEX idx_payroll_company_month ON payroll_record (company_id, pay_year_month);
CREATE INDEX idx_payroll_user          ON payroll_record (user_id);
