ALTER TABLE staff_attendance_record
    ADD COLUMN IF NOT EXISTS clock_in_ip_location VARCHAR(240),
    ADD COLUMN IF NOT EXISTS clock_out_ip_location VARCHAR(240);
