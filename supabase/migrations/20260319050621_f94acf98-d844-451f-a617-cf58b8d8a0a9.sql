-- Remove Notification Setup module permission rows from all profiles
DELETE FROM profile_object_permissions 
WHERE object_name IN (
  'admin_notification_setup',
  'admin_notification_templates',
  'admin_notification_schedules',
  'widget_admin_notification_list',
  'widget_admin_notification_templates'
);