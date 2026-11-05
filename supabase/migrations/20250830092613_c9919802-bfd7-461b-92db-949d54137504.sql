-- Insert default leave types
INSERT INTO leave_types (name, description) VALUES 
('Annual Leave', 'Yearly vacation leave'),
('Sick Leave', 'Medical/health related leave'),
('Personal Leave', 'Personal time off'),
('Emergency Leave', 'Urgent personal matters'),
('Maternity Leave', 'Maternity related leave'),
('Paternity Leave', 'Paternity related leave')
ON CONFLICT DO NOTHING;