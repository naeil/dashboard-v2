-- ============================================================
-- V5 : Add Orders, Customer, and expand KPIs
-- ============================================================

-- 1. Create Customer Table
CREATE TABLE customer (
    id                 BIGSERIAL    PRIMARY KEY,
    company_id         BIGINT       NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    customer_name      VARCHAR(255),
    customer_email     VARCHAR(255),
    customer_htel      VARCHAR(255) NOT NULL,
    customer_htel_hash VARCHAR(255),
    total_order_count  INTEGER      NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_htel UNIQUE (company_id, customer_htel)
);
CREATE INDEX idx_customer_company_htel ON customer (company_id, customer_htel);

-- 2. Create Orders Table
CREATE TABLE orders (
    uniq                VARCHAR(50)  PRIMARY KEY, 
    company_id          BIGINT       NOT NULL REFERENCES company(id),
    brand_id            BIGINT       NOT NULL REFERENCES brand(id),
    shop_id             BIGINT       NOT NULL REFERENCES store(id),  -- Matches 'store' table in V1
    product_id          BIGINT       REFERENCES product(id), 
    customer_id         BIGINT       REFERENCES customer(id), 
    sku_cd              VARCHAR(100) NOT NULL,
    gross_amt           NUMERIC(18,2) DEFAULT 0,  -- 총 판매금액
    discount_amt        NUMERIC(18,2) DEFAULT 0,  -- 총 할인금액
    shipping_fee        NUMERIC(18,2) DEFAULT 0,  -- 배송비
    pay_amt             NUMERIC(18,2) DEFAULT 0,  -- 실제 결제금액
    cancel_amt          NUMERIC(18,2) DEFAULT 0,  -- 취소 금액
    ord_status          VARCHAR(50)  NOT NULL,    
    pay_time            TIMESTAMPTZ,              
    wdate               TIMESTAMPTZ,              
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_fk_shop     ON orders (shop_id);
CREATE INDEX idx_orders_fk_product  ON orders (product_id);
CREATE INDEX idx_orders_fk_customer ON orders (customer_id);
CREATE INDEX idx_orders_stats_main  ON orders (company_id, pay_time, brand_id);

-- 3. Expand daily_sales_stats with KPIs
ALTER TABLE daily_sales_stats
ADD COLUMN cancel_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
ADD COLUMN orderer_count INTEGER       NOT NULL DEFAULT 0,
ADD COLUMN cancel_count  INTEGER       NOT NULL DEFAULT 0;

-- 4. Constraint Updates
-- Since V1 had product.sku_cd as UNIQUE (if it did, let's fix it, wait V1 didn't have sku_cd at all).
-- Let's check V1 product again: external_product_id was used.
-- We will add sku_cd to product if it doesn't exist, and make it unique by company.
ALTER TABLE product
ADD COLUMN IF NOT EXISTS sku_cd VARCHAR(100);

-- Make sure no duplicates exist before adding constraint (assuming empty or small dev data)
ALTER TABLE product 
ADD CONSTRAINT uq_product_sku UNIQUE (company_id, sku_cd);
