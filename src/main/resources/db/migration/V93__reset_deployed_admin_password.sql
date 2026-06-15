UPDATE dashboard_user
SET password_hash = 'pbkdf2$120000$QdoB9uNNY/GsQAPgBvBk0Q==$wzVu6Md7/xbjX7YysvQ7zWEfhJQeQJAVUzd0oKicVq8=',
    status = 'ACTIVE',
    updated_at = NOW()
WHERE username = 'admin';
