-- V115: Personal task board (Inbox / Today / Waiting / Done)
-- Purely additive table, does not modify any existing table.

CREATE TABLE personal_task (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL,
      category VARCHAR(20) NOT NULL DEFAULT 'INBOX',
      content VARCHAR(500) NOT NULL,
      memo VARCHAR(500),
      position INTEGER NOT NULL DEFAULT 0,
      created_by VARCHAR(100),
      done_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now()
  );

CREATE INDEX idx_personal_task_company_category ON personal_task (company_id, category, position);
