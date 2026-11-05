
-- feedback_questions table
CREATE TABLE public.feedback_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL DEFAULT 'visit',
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'rating',
  options jsonb,
  is_required boolean NOT NULL DEFAULT true,
  applies_to text NOT NULL DEFAULT 'all',
  retailer_ids uuid[],
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feedback_questions"
  ON public.feedback_questions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert feedback_questions"
  ON public.feedback_questions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update feedback_questions"
  ON public.feedback_questions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete feedback_questions"
  ON public.feedback_questions FOR DELETE TO authenticated USING (true);

-- feedback_policies table
CREATE TABLE public.feedback_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  module text NOT NULL DEFAULT 'visit',
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feedback_policies"
  ON public.feedback_policies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert feedback_policies"
  ON public.feedback_policies FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update feedback_policies"
  ON public.feedback_policies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete feedback_policies"
  ON public.feedback_policies FOR DELETE TO authenticated USING (true);

-- feedback_policy_rules table
CREATE TABLE public.feedback_policy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.feedback_policies(id) ON DELETE CASCADE,
  condition_type text NOT NULL,
  condition_operator text NOT NULL DEFAULT 'every_n',
  condition_value text NOT NULL DEFAULT '5',
  action_type text NOT NULL DEFAULT 'mandatory_feedback',
  question_set_module text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_policy_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feedback_policy_rules"
  ON public.feedback_policy_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert feedback_policy_rules"
  ON public.feedback_policy_rules FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update feedback_policy_rules"
  ON public.feedback_policy_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete feedback_policy_rules"
  ON public.feedback_policy_rules FOR DELETE TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON public.feedback_questions TO authenticated, anon;
GRANT ALL ON public.feedback_policies TO authenticated, anon;
GRANT ALL ON public.feedback_policy_rules TO authenticated, anon;
