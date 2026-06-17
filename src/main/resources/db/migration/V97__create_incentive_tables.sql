-- V97: Create incentive management tables
-- online_channel_performance: 온라인 채널별 성과 관리
CREATE TABLE IF NOT EXISTS online_channel_performance (
      id BIGSERIAL PRIMARY KEY,
      performance_month VARCHAR(7) NOT NULL,
      channel_name VARCHAR(100) NOT NULL,
      assignee_name VARCHAR(100),
      sales_amount BIGINT DEFAULT 0,
      manufacturing_cost BIGINT DEFAULT 0,
      advertising_cost BIGINT DEFAULT 0,
      commission_cost BIGINT DEFAULT 0,
      logistics_cost BIGINT DEFAULT 0,
      other_cost BIGINT DEFAULT 0,
      operating_profit BIGINT DEFAULT 0,
      incentive_eligible BOOLEAN DEFAULT TRUE,
      memo TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

-- client_performance: 거래처 성과 관리
CREATE TABLE IF NOT EXISTS client_performance (
      id BIGSERIAL PRIMARY KEY,
      client_name VARCHAR(200) NOT NULL,
      assignee_name VARCHAR(100),
      first_registered_date DATE,
      first_order_date DATE,
      first_order_amount BIGINT DEFAULT 0,
      cumulative_sales BIGINT DEFAULT 0,
      cumulative_operating_profit BIGINT DEFAULT 0,
      status VARCHAR(30) DEFAULT 'LEAD',
      memo TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

-- incentive_summary: 직원별 인센티브 요약
CREATE TABLE IF NOT EXISTS incentive_summary (
      id BIGSERIAL PRIMARY KEY,
      incentive_month VARCHAR(7) NOT NULL,
      employee_name VARCHAR(100) NOT NULL,
      online_incentive BIGINT DEFAULT 0,
      client_incentive BIGINT DEFAULT 0,
      total_incentive BIGINT DEFAULT 0,
      status VARCHAR(30) DEFAULT 'EXPECTED',
      memo TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
