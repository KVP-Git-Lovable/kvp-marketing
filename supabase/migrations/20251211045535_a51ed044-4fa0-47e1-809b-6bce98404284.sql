-- Add user_status column to distributor_users table
-- Status values: 'initiated' (email sent), 'active' (logged in), 'inactive' (1 month no login), 'deactivated' (2 months no login)
ALTER TABLE public.distributor_users 
ADD COLUMN IF NOT EXISTS user_status text NOT NULL DEFAULT 'initiated' 
CHECK (user_status IN ('initiated', 'active', 'inactive', 'deactivated'));

-- Add auth_user_id to link with Supabase auth users (for portal login)
ALTER TABLE public.distributor_users 
ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);

-- Add email_sent_at to track when login email was sent
ALTER TABLE public.distributor_users 
ADD COLUMN IF NOT EXISTS email_sent_at timestamp with time zone;

-- Add password_set_at to track when user set their password
ALTER TABLE public.distributor_users 
ADD COLUMN IF NOT EXISTS password_set_at timestamp with time zone;

-- Create index for faster auth_user_id lookups
CREATE INDEX IF NOT EXISTS idx_distributor_users_auth_user_id ON public.distributor_users(auth_user_id);

-- Create index for user_status for automatic status update queries
CREATE INDEX IF NOT EXISTS idx_distributor_users_status ON public.distributor_users(user_status);