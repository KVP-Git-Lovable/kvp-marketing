-- Add owner_id field to distributors table for mapping internal sales team member
ALTER TABLE public.distributors 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS owner_name TEXT;