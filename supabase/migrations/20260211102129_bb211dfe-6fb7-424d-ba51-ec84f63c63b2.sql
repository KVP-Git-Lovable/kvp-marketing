
-- Drop tenant-based RLS policies FIRST (they depend on tenant_id column)
DROP POLICY IF EXISTS "retailers_select_policy" ON public.retailers;
DROP POLICY IF EXISTS "retailers_insert_policy" ON public.retailers;
DROP POLICY IF EXISTS "retailers_update_policy" ON public.retailers;
DROP POLICY IF EXISTS "retailers_delete_policy" ON public.retailers;

-- Drop tenant_id trigger and function
DROP TRIGGER IF EXISTS trg_set_retailer_tenant_id ON public.retailers;
DROP FUNCTION IF EXISTS public.set_retailer_tenant_id();

-- Now drop tenant_id column
ALTER TABLE public.retailers DROP COLUMN IF EXISTS tenant_id;
