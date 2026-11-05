-- Add designation and level columns to distributor_users
ALTER TABLE public.distributor_users 
ADD COLUMN IF NOT EXISTS designation text,
ADD COLUMN IF NOT EXISTS user_level text DEFAULT 'staff',
ADD COLUMN IF NOT EXISTS requested_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_distributor_users_distributor_id ON public.distributor_users(distributor_id);
CREATE INDEX IF NOT EXISTS idx_distributor_users_is_active ON public.distributor_users(is_active);

-- Update RLS policies for admin management
DROP POLICY IF EXISTS "Admins can manage all distributor users" ON public.distributor_users;
CREATE POLICY "Admins can manage all distributor users"
ON public.distributor_users
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));