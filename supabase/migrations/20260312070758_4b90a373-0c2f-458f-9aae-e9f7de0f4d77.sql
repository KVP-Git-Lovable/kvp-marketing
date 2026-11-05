
-- Expense Groups table
CREATE TABLE public.expense_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  ta_type TEXT DEFAULT 'from_beat',
  fixed_ta_amount NUMERIC DEFAULT 0,
  da_amount NUMERIC DEFAULT 0,
  ta_per_km_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Expense Group Members junction table
CREATE TABLE public.expense_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.expense_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.expense_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_group_members ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated can read, admin can write
CREATE POLICY "Authenticated users can read expense_groups"
  ON public.expense_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage expense_groups"
  ON public.expense_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated users can read expense_group_members"
  ON public.expense_group_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage expense_group_members"
  ON public.expense_group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Grant permissions
GRANT ALL ON public.expense_groups TO authenticated;
GRANT ALL ON public.expense_group_members TO authenticated;
