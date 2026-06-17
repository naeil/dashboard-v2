CREATE TABLE IF NOT EXISTS work_report_feedback (
    id BIGSERIAL PRIMARY KEY,
        report_id BIGINT NOT NULL REFERENCES staff_work_report(id) ON DELETE CASCADE,
            company_id BIGINT NOT NULL DEFAULT 1,
                author_username VARCHAR(100) NOT NULL,
                    author_display_name VARCHAR(100),
                        content TEXT NOT NULL,
                            mentioned_usernames TEXT,
                                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                                    );

                                    CREATE INDEX IF NOT EXISTS idx_work_report_feedback_report_id ON work_report_feedback(report_id);
                                    CREATE INDEX IF NOT EXISTS idx_work_report_feedback_company_id ON work_report_feedback(company_id);
