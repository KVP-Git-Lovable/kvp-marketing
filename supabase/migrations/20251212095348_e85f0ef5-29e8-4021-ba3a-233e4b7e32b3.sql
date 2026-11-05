-- Add admin role for Girish
INSERT INTO user_roles (user_id, role)
VALUES ('0f30e6cf-66bf-4277-b821-d3e3967b5d78', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Add admin role for Ajay Prabhu
INSERT INTO user_roles (user_id, role)
VALUES ('6d7227ff-c408-4b33-92c4-6227807e539b', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;