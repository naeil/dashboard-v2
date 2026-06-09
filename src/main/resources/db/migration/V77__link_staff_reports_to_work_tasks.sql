ALTER TABLE staff_work_report
    ADD COLUMN IF NOT EXISTS linked_task_id BIGINT REFERENCES executive_work_task(id),
    ADD COLUMN IF NOT EXISTS linked_project_name VARCHAR(160);

CREATE INDEX IF NOT EXISTS idx_staff_work_report_linked_task
    ON staff_work_report(company_id, linked_task_id);

CREATE INDEX IF NOT EXISTS idx_staff_work_report_linked_project
    ON staff_work_report(company_id, linked_project_name);
