CREATE TABLE IF NOT EXISTS support_program (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL,
      program_name VARCHAR(300) NOT NULL,
      organization VARCHAR(200),
      applied_date DATE,
      amount NUMERIC(18, 2) DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'APPLYING' CHECK (status IN ('APPLYING', 'REVIEWING', 'SELECTED', 'REJECTED', 'DONE')),
      manager_name VARCHAR(100),
      memo TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );

CREATE INDEX IF NOT EXISTS idx_support_program_company_id ON support_program(company_id);
CREATE INDEX IF NOT EXISTS idx_support_program_status ON support_program(status);
