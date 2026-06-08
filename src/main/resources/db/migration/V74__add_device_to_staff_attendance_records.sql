ALTER TABLE staff_attendance_record
    ADD COLUMN IF NOT EXISTS clock_in_device VARCHAR(30),
    ADD COLUMN IF NOT EXISTS clock_out_device VARCHAR(30),
    ADD COLUMN IF NOT EXISTS clock_in_user_agent VARCHAR(500),
    ADD COLUMN IF NOT EXISTS clock_out_user_agent VARCHAR(500);
