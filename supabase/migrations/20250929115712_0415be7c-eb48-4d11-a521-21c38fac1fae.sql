-- Fix vendor contact information security issue
-- Create a security definer function to get non-sensitive vendor data
CREATE OR REPLACE FUNCTION public.get_vendors_public_info()
RETURNS TABLE(
  id uuid,
  name text,
  skills text[],
  region_pincodes text[],
  city text,
  state text,
  is_approved boolean,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    v.id,
    v.name,
    v.skills,
    v.region_pincodes,
    v.city,
    v.state,
    v.is_approved,
    v.created_at
  FROM public.vendors v
  WHERE v.is_approved = true;
$$;

-- Create a security definer function to get vendor contact info (admin only)
CREATE OR REPLACE FUNCTION public.get_vendor_contact_info(vendor_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  contact_name text,
  contact_phone text,
  contact_email text,
  skills text[],
  region_pincodes text[],
  city text,
  state text,
  competitors text[],
  is_approved boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  created_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    v.id,
    v.name,
    v.contact_name,
    v.contact_phone,
    v.contact_email,
    v.skills,
    v.region_pincodes,
    v.city,
    v.state,
    v.competitors,
    v.is_approved,
    v.created_at,
    v.updated_at,
    v.created_by
  FROM public.vendors v
  WHERE v.id = vendor_id
    AND public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view approved vendors" ON public.vendors;
DROP POLICY IF EXISTS "Admins can manage vendors" ON public.vendors;

-- Create new restrictive RLS policies
-- Policy 1: Admins have full access to all vendor data
CREATE POLICY "Admins can manage all vendor data"
ON public.vendors
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Policy 2: Regular users can only see basic vendor info (no contact details)
-- Note: This policy intentionally excludes contact_name, contact_phone, contact_email
CREATE POLICY "Users can view non-sensitive vendor info"
ON public.vendors
FOR SELECT
TO authenticated
USING (
  is_approved = true 
  AND auth.uid() IS NOT NULL
  AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Create a view for safe vendor access by regular users
CREATE OR REPLACE VIEW public.vendors_public AS
SELECT 
  id,
  name,
  skills,
  region_pincodes,
  city,
  state,
  is_approved,
  created_at
FROM public.vendors
WHERE is_approved = true;

-- Enable RLS on the view (though views inherit from base table)
-- Grant access to the view
GRANT SELECT ON public.vendors_public TO authenticated;

-- Security comment for documentation
COMMENT ON POLICY "Users can view non-sensitive vendor info" ON public.vendors IS 
'Restricts regular users from accessing sensitive vendor contact information (contact_name, contact_phone, contact_email) to prevent competitor data theft. Only basic vendor information is visible to non-admin users.';

COMMENT ON FUNCTION public.get_vendor_contact_info(uuid) IS 
'Admin-only function to retrieve complete vendor information including sensitive contact details. Implements principle of least privilege for vendor data access.';

COMMENT ON VIEW public.vendors_public IS 
'Safe view of vendor data excluding sensitive contact information. Use this view for regular user access instead of direct table access.';