ALTER TABLE staff_attendance_record
    ADD COLUMN IF NOT EXISTS clock_in_ip VARCHAR(80),
    ADD COLUMN IF NOT EXISTS clock_out_ip VARCHAR(80);
