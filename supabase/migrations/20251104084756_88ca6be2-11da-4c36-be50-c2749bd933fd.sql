-- Add verified column to retailers table
ALTER TABLE public.retailers 
ADD COLUMN verified boolean NOT NULL DEFAULT false;

-- Create index for verified column for better query performance
CREATE INDEX idx_retailers_verified ON public.retailers(verified);

-- Update RLS policy so admins can update verified status
-- Note: The existing "Admins can view all retailers" policy already allows SELECT
-- We need to add an UPDATE policy for admins

CREATE POLICY "Admins can update retailer verification status"
ON public.retailers
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));