-- Add territory owner and audit tracking fields
ALTER TABLE public.territories 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_updated_by uuid REFERENCES auth.users(id);

-- Create trigger to auto-update last_updated_by on update
CREATE OR REPLACE FUNCTION public.update_territory_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_by = auth.uid();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS territory_audit_trigger ON public.territories;
CREATE TRIGGER territory_audit_trigger
BEFORE UPDATE ON public.territories
FOR EACH ROW
EXECUTE FUNCTION public.update_territory_audit_fields();

-- Create trigger to set created_by on insert
CREATE OR REPLACE FUNCTION public.set_territory_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS territory_created_by_trigger ON public.territories;
CREATE TRIGGER territory_created_by_trigger
BEFORE INSERT ON public.territories
FOR EACH ROW
EXECUTE FUNCTION public.set_territory_created_by();