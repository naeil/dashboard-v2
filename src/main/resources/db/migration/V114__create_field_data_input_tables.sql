-- V114: L0 field-input layer (raw data entry by operations staff)
-- Adds 4 new, isolated tables for manual data entry:
-- field_sales_entry, field_ad_cost_entry, field_inventory_order_entry, field_other_cost_entry
-- These tables are purely additive and do not modify any existing table.

CREATE TABLE field_sales_entry (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  brand_id BIGINT,
  product_id BIGINT,
  channel_name VARCHAR(100),
  entry_date DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  sales_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  memo VARCHAR(500),
  created_by VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
  );

CREATE INDEX idx_field_sales_entry_company_date ON field_sales_entry (company_id, entry_date);
CREATE INDEX idx_field_sales_entry_product ON field_sales_entry (company_id, product_id);
CREATE INDEX idx_field_sales_entry_brand ON field_sales_entry (company_id, brand_id);

CREATE TABLE field_ad_cost_entry (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  brand_id BIGINT,
  product_id BIGINT,
  channel_name VARCHAR(100),
  entry_date DATE NOT NULL,
  ad_cost_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  memo VARCHAR(500),
  created_by VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
  );

CREATE INDEX idx_field_ad_cost_entry_company_date ON field_ad_cost_entry (company_id, entry_date);
CREATE INDEX idx_field_ad_cost_entry_product ON field_ad_cost_entry (company_id, product_id);
CREATE INDEX idx_field_ad_cost_entry_brand ON field_ad_cost_entry (company_id, brand_id);

CREATE TABLE field_inventory_order_entry (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  brand_id BIGINT,
  product_id BIGINT,
  entry_type VARCHAR(20) NOT NULL,
  entry_date DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  memo VARCHAR(500),
  created_by VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
  );

CREATE INDEX idx_field_inv_order_entry_company_date ON field_inventory_order_entry (company_id, entry_date);
CREATE INDEX idx_field_inv_order_entry_product ON field_inventory_order_entry (company_id, product_id);

CREATE TABLE field_other_cost_entry (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  brand_id BIGINT,
  product_id BIGINT,
  cost_category VARCHAR(50) NOT NULL,
  entry_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  memo VARCHAR(500),
  created_by VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
  );

CREATE INDEX idx_field_other_cost_entry_company_date ON field_other_cost_entry (company_id, entry_date);
CREATE INDEX idx_field_other_cost_entry_brand ON field_other_cost_entry (company_id, brand_id);
