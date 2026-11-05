-- Add feedback columns to retailer_visit_logs
ALTER TABLE public.retailer_visit_logs
ADD COLUMN IF NOT EXISTS location_feedback_reason TEXT,
ADD COLUMN IF NOT EXISTS location_feedback_notes TEXT;