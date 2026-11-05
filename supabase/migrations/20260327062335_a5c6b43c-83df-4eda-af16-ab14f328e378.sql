-- Add new columns to activity_events for location and place tracking
ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS activity_place text,
  ADD COLUMN IF NOT EXISTS start_latitude double precision,
  ADD COLUMN IF NOT EXISTS start_longitude double precision,
  ADD COLUMN IF NOT EXISTS end_latitude double precision,
  ADD COLUMN IF NOT EXISTS end_longitude double precision;