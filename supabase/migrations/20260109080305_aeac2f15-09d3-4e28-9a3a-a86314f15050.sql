-- Create hierarchy_targets table (Master target for hierarchy root)
CREATE TABLE public.hierarchy_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  root_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fy_year INTEGER NOT NULL,
  total_quantity_target NUMERIC NOT NULL DEFAULT 0,
  quantity_unit TEXT DEFAULT 'Kg',
  total_revenue_target NUMERIC NOT NULL DEFAULT 0,
  allocation_method TEXT NOT NULL DEFAULT 'equal', -- 'equal', 'percentage', 'manual'
  status TEXT DEFAULT 'draft', -- 'draft', 'published', 'locked'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(root_user_id, fy_year)
);

-- Create hierarchy_target_allocations table (Per-user allocation)
CREATE TABLE public.hierarchy_target_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hierarchy_target_id UUID NOT NULL REFERENCES public.hierarchy_targets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES public.profiles(id),
  level INTEGER NOT NULL DEFAULT 0,
  allocation_percentage NUMERIC NOT NULL DEFAULT 0,
  quantity_target NUMERIC NOT NULL DEFAULT 0,
  revenue_target NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE, -- NULL means still active
  allocation_method TEXT DEFAULT 'inherited', -- 'equal', 'percentage', 'manual', 'inherited'
  is_synced_to_my_target BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hierarchy_target_id, user_id, effective_from)
);

-- Create hierarchy_target_history table (Track changes for audit)
CREATE TABLE public.hierarchy_target_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hierarchy_target_id UUID REFERENCES public.hierarchy_targets(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL, -- 'joined', 'left', 'territory_change', 'target_adjustment', 'published', 'recalculated'
  previous_target JSONB,
  new_target JSONB,
  affected_users UUID[], -- List of user IDs affected by this change
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add source column to user_business_plans to track origin
ALTER TABLE public.user_business_plans 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual', -- 'manual', 'hierarchy'
ADD COLUMN IF NOT EXISTS hierarchy_allocation_id UUID REFERENCES public.hierarchy_target_allocations(id);

-- Enable RLS
ALTER TABLE public.hierarchy_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hierarchy_target_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hierarchy_target_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hierarchy_targets
CREATE POLICY "Admins can manage all hierarchy targets"
ON public.hierarchy_targets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Managers can view hierarchy targets where they are root"
ON public.hierarchy_targets
FOR SELECT
TO authenticated
USING (root_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Managers can create/update hierarchy targets for their team"
ON public.hierarchy_targets
FOR INSERT
TO authenticated
WITH CHECK (
  root_user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_manager(auth.uid())
);

CREATE POLICY "Managers can update their hierarchy targets"
ON public.hierarchy_targets
FOR UPDATE
TO authenticated
USING (
  root_user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  root_user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- RLS Policies for hierarchy_target_allocations
CREATE POLICY "Admins can manage all allocations"
ON public.hierarchy_target_allocations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can view their own allocations"
ON public.hierarchy_target_allocations
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR manager_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.hierarchy_targets ht 
    WHERE ht.id = hierarchy_target_id AND ht.root_user_id = auth.uid()
  )
);

CREATE POLICY "Managers can insert allocations for their hierarchy"
ON public.hierarchy_target_allocations
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.hierarchy_targets ht 
    WHERE ht.id = hierarchy_target_id AND ht.root_user_id = auth.uid()
  )
);

CREATE POLICY "Managers can update allocations for their hierarchy"
ON public.hierarchy_target_allocations
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.hierarchy_targets ht 
    WHERE ht.id = hierarchy_target_id AND ht.root_user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.hierarchy_targets ht 
    WHERE ht.id = hierarchy_target_id AND ht.root_user_id = auth.uid()
  )
);

-- RLS Policies for hierarchy_target_history
CREATE POLICY "Admins can view all history"
ON public.hierarchy_target_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can view history for their hierarchy"
ON public.hierarchy_target_history
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR auth.uid() = ANY(affected_users)
  OR EXISTS (
    SELECT 1 FROM public.hierarchy_targets ht 
    WHERE ht.id = hierarchy_target_id AND ht.root_user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can insert history"
ON public.hierarchy_target_history
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_hierarchy_targets_root_user ON public.hierarchy_targets(root_user_id);
CREATE INDEX idx_hierarchy_targets_fy_year ON public.hierarchy_targets(fy_year);
CREATE INDEX idx_hierarchy_allocations_user ON public.hierarchy_target_allocations(user_id);
CREATE INDEX idx_hierarchy_allocations_manager ON public.hierarchy_target_allocations(manager_id);
CREATE INDEX idx_hierarchy_allocations_target ON public.hierarchy_target_allocations(hierarchy_target_id);
CREATE INDEX idx_hierarchy_history_target ON public.hierarchy_target_history(hierarchy_target_id);
CREATE INDEX idx_hierarchy_history_user ON public.hierarchy_target_history(user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_hierarchy_targets_updated_at
BEFORE UPDATE ON public.hierarchy_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hierarchy_allocations_updated_at
BEFORE UPDATE ON public.hierarchy_target_allocations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();