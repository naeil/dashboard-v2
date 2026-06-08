CREATE TABLE IF NOT EXISTS executive_partner (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    partner_name VARCHAR(160) NOT NULL,
    partner_type VARCHAR(40) NOT NULL DEFAULT 'SALES',
    business_scope VARCHAR(200),
    manager_name VARCHAR(80),
    owner_name VARCHAR(80),
    contact VARCHAR(80),
    tax_email VARCHAR(120),
    bank_account VARCHAR(160),
    settlement_terms VARCHAR(200),
    country VARCHAR(80),
    contract_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    last_contact_date DATE,
    memo VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executive_partner_company
    ON executive_partner(company_id);

CREATE INDEX IF NOT EXISTS idx_executive_partner_name
    ON executive_partner(company_id, partner_name);

ALTER TABLE executive_receivable
    ADD COLUMN IF NOT EXISTS partner_id BIGINT;

INSERT INTO executive_partner (
    company_id, partner_name, partner_type, business_scope, manager_name,
    owner_name, contact, tax_email, bank_account, settlement_terms, country,
    contract_status, last_contact_date, memo, created_at
)
SELECT
    company_id,
    partner_name,
    COALESCE(partner_type, 'SALES'),
    MAX(business_scope),
    MAX(manager_name),
    MAX(owner_name),
    MAX(contact),
    MAX(tax_email),
    MAX(bank_account),
    MAX(settlement_terms),
    MAX(country),
    COALESCE(MAX(contract_status), 'ACTIVE'),
    MAX(last_contact_date),
    MAX(memo),
    MIN(created_at)
FROM executive_receivable r
WHERE NOT EXISTS (
    SELECT 1
    FROM executive_partner p
    WHERE p.company_id = r.company_id
      AND p.partner_name = r.partner_name
      AND COALESCE(p.manager_name, '') = COALESCE(r.manager_name, '')
      AND COALESCE(p.contact, '') = COALESCE(r.contact, '')
)
GROUP BY company_id, partner_name, COALESCE(partner_type, 'SALES'), COALESCE(manager_name, ''), COALESCE(contact, '');

UPDATE executive_receivable r
SET partner_id = p.id
FROM executive_partner p
WHERE r.partner_id IS NULL
  AND p.company_id = r.company_id
  AND p.partner_name = r.partner_name
  AND COALESCE(p.manager_name, '') = COALESCE(r.manager_name, '')
  AND COALESCE(p.contact, '') = COALESCE(r.contact, '');

ALTER TABLE executive_receivable
    ADD CONSTRAINT fk_executive_receivable_partner
    FOREIGN KEY (partner_id) REFERENCES executive_partner(id) ON DELETE SET NULL;
