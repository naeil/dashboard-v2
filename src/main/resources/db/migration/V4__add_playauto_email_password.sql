-- V4: Add Playauto Email and Password columns to integration_settings
ALTER TABLE integration_settings
ADD COLUMN api_email VARCHAR(500),
ADD COLUMN api_password VARCHAR(500);
