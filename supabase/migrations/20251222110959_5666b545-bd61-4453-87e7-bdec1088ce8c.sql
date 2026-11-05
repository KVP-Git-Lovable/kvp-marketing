-- Add secondary_manager_id column to employees table
ALTER TABLE public.employees 
ADD COLUMN secondary_manager_id uuid REFERENCES auth.users(id);

-- Add index for better query performance
CREATE INDEX idx_employees_secondary_manager_id ON public.employees(secondary_manager_id);