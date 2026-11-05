-- Add new columns to beat_allowances table for average KM and time
ALTER TABLE public.beat_allowances 
ADD COLUMN average_km numeric DEFAULT 0,
ADD COLUMN average_time_minutes integer DEFAULT 0;

-- Add comments to explain the new columns
COMMENT ON COLUMN public.beat_allowances.average_km IS 'Average distance in kilometers to cover the beat';
COMMENT ON COLUMN public.beat_allowances.average_time_minutes IS 'Average time in minutes to cover the beat';