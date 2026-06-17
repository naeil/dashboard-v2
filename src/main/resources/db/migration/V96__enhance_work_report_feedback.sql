-- V96: enhance work_report_feedback table for task tracking
-- Add feedback_type, assignee_name, due_date, status columns to existing work_report_feedback table

ALTER TABLE work_report_feedback
  ADD COLUMN IF NOT EXISTS feedback_type VARCHAR(30) NOT NULL DEFAULT 'CHECK_REQUEST',
  ADD COLUMN IF NOT EXISTS assignee_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'PENDING';

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_work_report_feedback_status ON work_report_feedback(status);
CREATE INDEX IF NOT EXISTS idx_work_report_feedback_due_date ON work_report_feedback(due_date);
