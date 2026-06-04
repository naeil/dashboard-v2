CREATE TABLE IF NOT EXISTS executive_work_task (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company(id),
    project_name VARCHAR(160) NOT NULL,
    task_name VARCHAR(220) NOT NULL,
    assignee_name VARCHAR(80) NOT NULL,
    department VARCHAR(80),
    work_category VARCHAR(60) NOT NULL DEFAULT 'NPD',
    linked_product_name VARCHAR(160),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(30) NOT NULL DEFAULT 'WAITING',
    progress_rate INTEGER NOT NULL DEFAULT 0,
    start_date DATE,
    due_date DATE,
    completed_date DATE,
    approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    today_work TEXT,
    blocker_text TEXT,
    next_action TEXT,
    request_text TEXT,
    review_comment TEXT,
    source_type VARCHAR(40),
    source_key VARCHAR(160),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executive_work_task_company
    ON executive_work_task(company_id);

CREATE INDEX IF NOT EXISTS idx_executive_work_task_assignee
    ON executive_work_task(company_id, assignee_name);

CREATE INDEX IF NOT EXISTS idx_executive_work_task_status_due
    ON executive_work_task(company_id, status, due_date);
