INSERT INTO notification_event_types (event_code, label, description, is_active)
VALUES ('AUTO_DAY_CLOSED', 'Day Auto-Closed', 'Triggered when attendance is automatically closed at midnight', true)
ON CONFLICT DO NOTHING;