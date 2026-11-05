ALTER TABLE public.auto_end_day_policy ADD COLUMN pre_warning_time TEXT NOT NULL DEFAULT '22:00';

UPDATE public.auto_end_day_policy 
SET pre_warning_time = 
  LPAD(
    (EXTRACT(HOUR FROM (auto_close_time::time - (pre_warning_minutes_before || ' minutes')::interval)))::TEXT, 
    2, '0'
  ) || ':' || 
  LPAD(
    (EXTRACT(MINUTE FROM (auto_close_time::time - (pre_warning_minutes_before || ' minutes')::interval)))::TEXT, 
    2, '0'
  );