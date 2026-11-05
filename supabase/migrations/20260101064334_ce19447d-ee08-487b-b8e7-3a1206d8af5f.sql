-- Add designation and social media fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS designation text,
ADD COLUMN IF NOT EXISTS twitter_url text;

-- Create work_experiences table
CREATE TABLE IF NOT EXISTS public.work_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  designation text,
  from_date date,
  to_date date,
  is_current boolean DEFAULT false,
  description text,
  location text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.work_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all work experiences" ON public.work_experiences
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own work experiences" ON public.work_experiences
  FOR ALL USING (auth.uid() = user_id);

-- Create education_history table
CREATE TABLE IF NOT EXISTS public.education_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_name text NOT NULL,
  degree text,
  field_of_study text,
  from_date date,
  to_date date,
  grade text,
  activities text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.education_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all education history" ON public.education_history
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own education history" ON public.education_history
  FOR ALL USING (auth.uid() = user_id);

-- Create emergency_contacts table
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  relationship text,
  phone text,
  alternate_phone text,
  address text,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own emergency contacts" ON public.emergency_contacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own emergency contacts" ON public.emergency_contacts
  FOR ALL USING (auth.uid() = user_id);

-- Create aspirations_and_preferences table
CREATE TABLE IF NOT EXISTS public.aspirations_and_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  career_goal text,
  dream_role text,
  preferred_work_style text,
  motivation_driver text,
  five_year_vision text,
  favorite_activity text,
  preferred_reward text,
  team_preference text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.aspirations_and_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all aspirations" ON public.aspirations_and_preferences
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own aspirations" ON public.aspirations_and_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Create onboarding_checklist table (admin-defined tasks)
CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name text NOT NULL,
  description text,
  category text,
  requires_attachment boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view onboarding tasks" ON public.onboarding_tasks
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage onboarding tasks" ON public.onboarding_tasks
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create user_onboarding_progress table
CREATE TABLE IF NOT EXISTS public.user_onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  is_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  attachment_url text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, task_id)
);

ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own onboarding progress" ON public.user_onboarding_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own onboarding progress" ON public.user_onboarding_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all onboarding progress" ON public.user_onboarding_progress
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Add hq_territory_id to employees if not exists (for territory lookup)
-- Note: Column already exists based on schema

-- Insert default onboarding tasks
INSERT INTO public.onboarding_tasks (task_name, description, category, requires_attachment, sort_order) VALUES
('Complete Profile Information', 'Fill in all personal and contact details', 'Profile Setup', false, 1),
('Upload Profile Photo', 'Add a professional profile picture', 'Profile Setup', true, 2),
('Read Company Policies', 'Review and acknowledge company policies and guidelines', 'Documentation', false, 3),
('Submit ID Proof', 'Upload a valid government ID proof (Aadhar/PAN)', 'Documentation', true, 4),
('Complete Safety Training', 'Complete the mandatory safety training module', 'Training', false, 5),
('Product Knowledge Training', 'Complete product training and quiz', 'Training', false, 6),
('Meet Your Manager', 'Schedule and complete introductory meeting with manager', 'Orientation', false, 7),
('Territory Familiarization', 'Complete field visit with senior colleague', 'Orientation', false, 8)
ON CONFLICT DO NOTHING;