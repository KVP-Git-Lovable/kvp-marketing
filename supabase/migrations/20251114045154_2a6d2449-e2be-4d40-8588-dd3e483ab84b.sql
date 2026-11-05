-- Add face verification columns for check-out to attendance table
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS face_verification_status_out TEXT,
ADD COLUMN IF NOT EXISTS face_match_confidence_out NUMERIC;