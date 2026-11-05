-- Add assigned_user_id column to vans table for user-van assignment
ALTER TABLE public.vans
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vans_assigned_user_id ON public.vans(assigned_user_id);

-- Add comment for documentation
COMMENT ON COLUMN public.vans.assigned_user_id IS 'The user assigned to this van. Used to pre-select the van in Van Stock Management.';