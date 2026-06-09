UPDATE dashboard_user
SET password_hash = 'pbkdf2$120000$bmFlaWwtc3RhZmYtaW5pdDE=$Xdu9w7tSgHBuvMOO0HbcMHvqiOQUjCjt37CS1GXM4c4=',
    updated_at = NOW()
WHERE role IN ('EMPLOYEE', 'MANAGER');
