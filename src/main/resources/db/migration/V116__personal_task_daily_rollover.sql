-- V116: Daily rollover support for personal_task
-- Purely additive columns, does not modify any existing table.

ALTER TABLE personal_task ADD COLUMN board_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE personal_task ADD COLUMN original_date DATE NOT NULL DEFAULT CURRENT_DATE;

UPDATE personal_task SET board_date = created_at::date, original_date = created_at::date;

CREATE INDEX idx_personal_task_company_board_date ON personal_task (company_id, board_date);
