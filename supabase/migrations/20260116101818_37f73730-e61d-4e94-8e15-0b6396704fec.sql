-- Add unique constraint on attendance(user_id, date) for upsert operations
-- First check if it exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'attendance_user_id_date_key'
  ) THEN
    ALTER TABLE public.attendance 
    ADD CONSTRAINT attendance_user_id_date_key UNIQUE (user_id, date);
  END IF;
END $$;

-- Add regularized_request_id column to track which request regularized this attendance
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS regularized_request_id UUID REFERENCES public.regularization_requests(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_regularization_requests_user_date 
ON public.regularization_requests(user_id, attendance_date);