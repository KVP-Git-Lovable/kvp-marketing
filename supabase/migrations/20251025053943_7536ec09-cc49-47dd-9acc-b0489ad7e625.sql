-- Create competency framework table
CREATE TABLE public.competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL, -- 'technical', 'behavioral', 'leadership', 'domain'
  level_definitions jsonb, -- {beginner: '', intermediate: '', advanced: '', expert: ''}
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create role definitions table
CREATE TABLE public.role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text NOT NULL UNIQUE,
  description text,
  responsibilities text[],
  required_competencies jsonb, -- [{competency_id: '', required_level: ''}]
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create employee competencies table
CREATE TABLE public.employee_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  competency_id uuid REFERENCES public.competencies(id) ON DELETE CASCADE NOT NULL,
  current_level text NOT NULL, -- 'beginner', 'intermediate', 'advanced', 'expert'
  assessed_by uuid REFERENCES auth.users(id),
  assessed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, competency_id)
);

-- Create employee connections table (following system)
CREATE TABLE public.employee_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create badges and awards table
CREATE TABLE public.employee_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_name text NOT NULL,
  badge_description text,
  badge_type text NOT NULL, -- 'achievement', 'certification', 'award', 'milestone'
  badge_icon text, -- URL or icon name
  issued_by uuid REFERENCES auth.users(id),
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create employee recommendations table
CREATE TABLE public.employee_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- person being recommended
  recommender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- person giving recommendation
  recommendation_text text NOT NULL,
  relationship text, -- 'colleague', 'manager', 'client'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Extend profiles table with additional onboarding fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_picture_url text,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS anniversary_date date,
ADD COLUMN IF NOT EXISTS permanent_address text,
ADD COLUMN IF NOT EXISTS current_address text,
ADD COLUMN IF NOT EXISTS emergency_contact_name text,
ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS interests text[],
ADD COLUMN IF NOT EXISTS aspirations text,
ADD COLUMN IF NOT EXISTS learning_goals text[],
ADD COLUMN IF NOT EXISTS work_location text,
ADD COLUMN IF NOT EXISTS territories_covered text[],
ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.role_definitions(id),
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0;

-- Extend employees table with education and expertise
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS education_background jsonb, -- [{degree: '', institution: '', year: '', field: ''}]
ADD COLUMN IF NOT EXISTS certifications jsonb, -- [{name: '', issuer: '', year: '', credential_id: ''}]
ADD COLUMN IF NOT EXISTS aadhar_document_url text,
ADD COLUMN IF NOT EXISTS pan_document_url text,
ADD COLUMN IF NOT EXISTS expertise_areas text[];

-- Enable RLS
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for competencies
CREATE POLICY "Authenticated users can view competencies"
ON public.competencies FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage competencies"
ON public.competencies FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for role_definitions
CREATE POLICY "Authenticated users can view role definitions"
ON public.role_definitions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage role definitions"
ON public.role_definitions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for employee_competencies
CREATE POLICY "Users can view their own competencies"
ON public.employee_competencies FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage competencies"
ON public.employee_competencies FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for employee_connections
CREATE POLICY "Users can view connections"
ON public.employee_connections FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can manage their own connections"
ON public.employee_connections FOR ALL
TO authenticated
USING (auth.uid() = follower_id);

-- RLS Policies for employee_badges
CREATE POLICY "Users can view badges"
ON public.employee_badges FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage badges"
ON public.employee_badges FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for employee_recommendations
CREATE POLICY "Users can view recommendations"
ON public.employee_recommendations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create recommendations"
ON public.employee_recommendations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = recommender_id);

CREATE POLICY "Users can update their own recommendations"
ON public.employee_recommendations FOR UPDATE
TO authenticated
USING (auth.uid() = recommender_id);

-- Create indexes for performance
CREATE INDEX idx_employee_competencies_user_id ON public.employee_competencies(user_id);
CREATE INDEX idx_employee_connections_follower ON public.employee_connections(follower_id);
CREATE INDEX idx_employee_connections_following ON public.employee_connections(following_id);
CREATE INDEX idx_employee_badges_user_id ON public.employee_badges(user_id);
CREATE INDEX idx_employee_recommendations_user_id ON public.employee_recommendations(user_id);