-- Drop the existing role check constraint and add sales to allowed roles
ALTER TABLE public.distributor_users DROP CONSTRAINT distributor_users_role_check;

ALTER TABLE public.distributor_users 
ADD CONSTRAINT distributor_users_role_check 
CHECK (role = ANY (ARRAY['owner'::text, 'manager'::text, 'warehouse'::text, 'accounts'::text, 'staff'::text, 'sales'::text]));