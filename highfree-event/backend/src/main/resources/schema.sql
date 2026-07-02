-- highfree-event PostgreSQL Schema
-- QR Codes master table
CREATE TABLE IF NOT EXISTS qr_codes (
    id BIGSERIAL PRIMARY KEY,
    qr_id VARCHAR(100) UNIQUE NOT NULL,
    country VARCHAR(10),
    channel VARCHAR(100),
    product VARCHAR(100),
    flavor VARCHAR(100),
    campaign VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Sessions (QR scan logs)
CREATE TABLE IF NOT EXISTS event_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    qr_code_id BIGINT REFERENCES qr_codes(id),
    ip_address VARCHAR(50),
    user_agent TEXT,
    referrer TEXT,
    country VARCHAR(10),
    channel VARCHAR(100),
    product VARCHAR(100),
    flavor VARCHAR(100),
    campaign VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spin Results (server-side spin outcomes)
CREATE TABLE IF NOT EXISTS spin_results (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID UNIQUE NOT NULL REFERENCES event_sessions(session_id),
    reward_key VARCHAR(50) NOT NULL,
    reward_label VARCHAR(200) NOT NULL,
    reward_points INTEGER NOT NULL DEFAULT 0,
    is_retry BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers (phone number registry)
CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    marketing_agree BOOLEAN DEFAULT FALSE,
    upup_user_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Point Transactions
CREATE TABLE IF NOT EXISTS point_transactions (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    session_id UUID REFERENCES event_sessions(session_id),
    tx_type VARCHAR(20) NOT NULL DEFAULT 'EARN',
    points INTEGER NOT NULL DEFAULT 0,
    description VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_sessions_qr_code_id ON event_sessions(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_event_sessions_created_at ON event_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_event_sessions_ip ON event_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_spin_results_created_at ON spin_results(created_at);
CREATE INDEX IF NOT EXISTS idx_point_transactions_customer_id ON point_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON point_transactions(created_at);
