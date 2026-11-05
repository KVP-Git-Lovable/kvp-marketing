-- Add territory_id to retailers table
ALTER TABLE public.retailers ADD COLUMN territory_id UUID REFERENCES public.territories(id);

-- Change territories to support multiple users (using JSONB array for user IDs)
ALTER TABLE public.territories ADD COLUMN assigned_user_ids JSONB DEFAULT '[]'::jsonb;

-- Add distributor assignments to territories (using JSONB array for distributor IDs)
ALTER TABLE public.territories ADD COLUMN assigned_distributor_ids JSONB DEFAULT '[]'::jsonb;

-- Create index for better query performance
CREATE INDEX idx_retailers_territory_id ON public.retailers(territory_id);
CREATE INDEX idx_territories_assigned_users ON public.territories USING gin(assigned_user_ids);
CREATE INDEX idx_territories_assigned_distributors ON public.territories USING gin(assigned_distributor_ids);