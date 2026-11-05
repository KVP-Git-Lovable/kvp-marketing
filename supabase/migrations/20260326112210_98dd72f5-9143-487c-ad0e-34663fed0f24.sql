-- User-level expense config overrides
CREATE TABLE IF NOT EXISTS public.user_expense_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  ta_type text CHECK (ta_type IN ('fixed', 'from_beat')),
  fixed_ta_amount numeric DEFAULT 0,
  da_amount numeric DEFAULT 0,
  max_additional_expense_per_day numeric DEFAULT 0,
  max_additional_expense_per_month numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Team/manager-level expense config overrides
CREATE TABLE IF NOT EXISTS public.team_expense_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  ta_type text CHECK (ta_type IN ('fixed', 'from_beat')),
  fixed_ta_amount numeric DEFAULT 0,
  da_amount numeric DEFAULT 0,
  max_additional_expense_per_day numeric DEFAULT 0,
  max_additional_expense_per_month numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Expense Groups table
CREATE TABLE IF NOT EXISTS public.expense_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  ta_type TEXT CHECK (ta_type IN ('fixed', 'from_beat')),
  fixed_ta_amount NUMERIC DEFAULT 0,
  da_amount NUMERIC DEFAULT 0,
  max_additional_expense_per_day NUMERIC DEFAULT 0,
  max_additional_expense_per_month NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Expense Group Members junction table
CREATE TABLE IF NOT EXISTS public.expense_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.expense_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.user_expense_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_expense_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_group_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_expense_config
CREATE POLICY "Admin full access on user_expense_config" ON public.user_expense_config
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own expense config" ON public.user_expense_config
  FOR SELECT USING (auth.uid() = user_id);

-- RLS policies for team_expense_config
CREATE POLICY "Admin full access on team_expense_config" ON public.team_expense_config
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read team config" ON public.team_expense_config
  FOR SELECT USING (true);

-- RLS policies for expense_groups
CREATE POLICY "Authenticated users can read expense_groups"
  ON public.expense_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage expense_groups"
  ON public.expense_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS policies for expense_group_members
CREATE POLICY "Authenticated users can read expense_group_members"
  ON public.expense_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage expense_group_members"
  ON public.expense_group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Grants
GRANT ALL ON public.user_expense_config TO authenticated;
GRANT ALL ON public.team_expense_config TO authenticated;
GRANT ALL ON public.expense_groups TO authenticated;
GRANT ALL ON public.expense_group_members TO authenticated;