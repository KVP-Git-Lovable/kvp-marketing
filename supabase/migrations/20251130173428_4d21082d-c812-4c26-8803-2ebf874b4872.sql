-- Add joint sales manager field to beat_plans
ALTER TABLE beat_plans 
ADD COLUMN joint_sales_manager_id uuid REFERENCES auth.users(id);

-- Create joint sales feedback table
CREATE TABLE joint_sales_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES visits(id),
  retailer_id uuid NOT NULL REFERENCES retailers(id),
  manager_id uuid REFERENCES auth.users(id) NOT NULL,
  fse_user_id uuid REFERENCES auth.users(id) NOT NULL,
  beat_plan_id uuid REFERENCES beat_plans(id),
  feedback_date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Star ratings (1-5)
  branding_rating integer CHECK (branding_rating BETWEEN 1 AND 5),
  retailing_rating integer CHECK (retailing_rating BETWEEN 1 AND 5),
  pricing_feedback_rating integer CHECK (pricing_feedback_rating BETWEEN 1 AND 5),
  schemes_rating integer CHECK (schemes_rating BETWEEN 1 AND 5),
  competition_rating integer CHECK (competition_rating BETWEEN 1 AND 5),
  product_feedback_rating integer CHECK (product_feedback_rating BETWEEN 1 AND 5),
  sampling_rating integer CHECK (sampling_rating BETWEEN 1 AND 5),
  distributor_feedback_rating integer CHECK (distributor_feedback_rating BETWEEN 1 AND 5),
  sales_trends_rating integer CHECK (sales_trends_rating BETWEEN 1 AND 5),
  future_growth_rating integer CHECK (future_growth_rating BETWEEN 1 AND 5),
  
  -- Dropdown selections
  branding_status text,
  shelf_visibility text,
  pricing_compliance text,
  scheme_awareness text,
  competition_presence text,
  sampling_status text,
  distributor_service text,
  sales_trend text,
  growth_potential text,
  
  -- Text fields
  retailer_notes text,
  conversation_highlights text,
  action_items text,
  additional_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create joint sales sessions tracking table
CREATE TABLE joint_sales_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid REFERENCES auth.users(id) NOT NULL,
  fse_user_id uuid REFERENCES auth.users(id) NOT NULL,
  beat_plan_id uuid REFERENCES beat_plans(id),
  session_date date NOT NULL,
  beat_id text,
  beat_name text,
  total_retailers_visited integer DEFAULT 0,
  total_feedback_captured integer DEFAULT 0,
  session_start_time timestamptz,
  session_end_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE joint_sales_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE joint_sales_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for joint_sales_feedback
CREATE POLICY "Managers can create feedback for their joint visits"
ON joint_sales_feedback FOR INSERT
WITH CHECK (auth.uid() = manager_id);

CREATE POLICY "Managers can view their own feedback"
ON joint_sales_feedback FOR SELECT
USING (auth.uid() = manager_id);

CREATE POLICY "FSEs can view feedback for their beats"
ON joint_sales_feedback FOR SELECT
USING (auth.uid() = fse_user_id);

CREATE POLICY "Managers can update their own feedback"
ON joint_sales_feedback FOR UPDATE
USING (auth.uid() = manager_id);

CREATE POLICY "Admins can manage all feedback"
ON joint_sales_feedback FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for joint_sales_sessions
CREATE POLICY "Managers can view their own sessions"
ON joint_sales_sessions FOR SELECT
USING (auth.uid() = manager_id);

CREATE POLICY "FSEs can view sessions for their beats"
ON joint_sales_sessions FOR SELECT
USING (auth.uid() = fse_user_id);

CREATE POLICY "System can manage sessions"
ON joint_sales_sessions FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage all sessions"
ON joint_sales_sessions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));