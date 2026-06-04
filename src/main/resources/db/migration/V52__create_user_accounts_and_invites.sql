CREATE TABLE IF NOT EXISTS dashboard_user (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    username VARCHAR(80) NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    department VARCHAR(80),
    position_name VARCHAR(80),
    role VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE',
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_dashboard_user_role CHECK (role IN ('EMPLOYEE', 'MANAGER', 'EXECUTIVE')),
    CONSTRAINT chk_dashboard_user_status CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED', 'LEFT', 'BLOCKED'))
);

CREATE INDEX IF NOT EXISTS idx_dashboard_user_company_role
    ON dashboard_user(company_id, role);

CREATE TABLE IF NOT EXISTS dashboard_user_invite (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    invite_code VARCHAR(40) NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    department VARCHAR(80),
    position_name VARCHAR(80),
    role VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    invited_by VARCHAR(80),
    accepted_by VARCHAR(80),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_dashboard_user_invite_role CHECK (role IN ('EMPLOYEE', 'MANAGER', 'EXECUTIVE')),
    CONSTRAINT chk_dashboard_user_invite_status CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_dashboard_user_invite_company_status
    ON dashboard_user_invite(company_id, status, expires_at);
