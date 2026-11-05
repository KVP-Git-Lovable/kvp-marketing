
-- User-level expense config overrides
CREATE TABLE public.user_expense_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  ta_type text CHECK (ta_type IN ('fixed', 'from_beat')),
  fixed_ta_amount numeric DEFAULT 0,
  da_amount numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Team/manager-level expense config overrides
CREATE TABLE public.team_expense_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  ta_type text CHECK (ta_type IN ('fixed', 'from_beat')),
  fixed_ta_amount numeric DEFAULT 0,
  da_amount numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_expense_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_expense_config ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin full access on user_expense_config" ON public.user_expense_config
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin full access on team_expense_config" ON public.team_expense_config
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read their own config
CREATE POLICY "Users can read own expense config" ON public.user_expense_config
  FOR SELECT USING (auth.uid() = user_id);

-- Authenticated users can read team config for their manager
CREATE POLICY "Users can read team config" ON public.team_expense_config
  FOR SELECT USING (true);

-- Grant permissions
GRANT ALL ON public.user_expense_config TO authenticated;
GRANT ALL ON public.team_expense_config TO authenticated;
GRANT ALL ON public.user_expense_config TO anon;
GRANT ALL ON public.team_expense_config TO anon;
