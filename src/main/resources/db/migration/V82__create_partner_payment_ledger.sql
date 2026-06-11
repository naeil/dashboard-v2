CREATE TABLE IF NOT EXISTS partner_payment_ledger (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL,
      partner_name VARCHAR(200) NOT NULL,
      direction VARCHAR(10) NOT NULL CHECK (direction IN ('RECEIVABLE', 'PAYABLE')),
      amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
      issue_date DATE,
      due_date DATE,
      tax_invoice_issued BOOLEAN NOT NULL DEFAULT FALSE,
      payment_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      description TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DONE', 'CANCELLED')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

CREATE INDEX IF NOT EXISTS idx_partner_payment_ledger_company_id ON partner_payment_ledger(company_id);
CREATE INDEX IF NOT EXISTS idx_partner_payment_ledger_direction ON partner_payment_ledger(direction);
CREATE INDEX IF NOT EXISTS idx_partner_payment_ledger_status ON partner_payment_ledger(status);
CREATE INDEX IF NOT EXISTS idx_partner_payment_ledger_due_date ON partner_payment_ledger(due_date);
