-- =============================================
-- SALES COACH MODULE - Complete Database Schema
-- =============================================

-- 1. Competency Framework Master Table
CREATE TABLE public.coach_competencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- e.g., 'Product Knowledge', 'Territory Planning', 'Relationship Building'
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Learning Content Library
CREATE TABLE public.coach_learning_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL, -- 'video', 'article', 'case_study', 'interactive'
  content_url TEXT, -- URL for video or external content
  content_body TEXT, -- For articles/text content
  thumbnail_url TEXT,
  duration_minutes INTEGER,
  difficulty_level TEXT DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
  competency_id UUID REFERENCES public.coach_competencies(id),
  points_on_completion INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Quiz Questions Bank
CREATE TABLE public.coach_quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice', -- 'multiple_choice', 'true_false', 'scenario'
  options JSONB, -- Array of options for multiple choice
  correct_answer TEXT NOT NULL,
  explanation TEXT, -- Explanation shown after answering
  competency_id UUID REFERENCES public.coach_competencies(id),
  learning_content_id UUID REFERENCES public.coach_learning_content(id),
  difficulty_level TEXT DEFAULT 'beginner',
  points INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Scenario/Case Studies
CREATE TABLE public.coach_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  scenario_text TEXT NOT NULL,
  scenario_type TEXT DEFAULT 'objection_handling', -- 'objection_handling', 'closing', 'relationship'
  options JSONB, -- Array of response options
  best_option TEXT NOT NULL,
  feedback JSONB, -- Feedback for each option
  competency_id UUID REFERENCES public.coach_competencies(id),
  difficulty_level TEXT DEFAULT 'intermediate',
  points INTEGER DEFAULT 15,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. User Learning Progress
CREATE TABLE public.coach_user_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  learning_content_id UUID REFERENCES public.coach_learning_content(id),
  status TEXT DEFAULT 'not_started', -- 'not_started', 'in_progress', 'completed'
  progress_percent INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, learning_content_id)
);

-- 6. User Quiz Attempts
CREATE TABLE public.coach_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID REFERENCES public.coach_quiz_questions(id),
  user_answer TEXT,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. User Scenario Attempts
CREATE TABLE public.coach_scenario_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scenario_id UUID REFERENCES public.coach_scenarios(id),
  selected_option TEXT,
  is_best_choice BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. User Competency Scores (Dynamic)
CREATE TABLE public.coach_user_competency_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  competency_id UUID REFERENCES public.coach_competencies(id),
  current_score INTEGER DEFAULT 0, -- 0-100
  previous_score INTEGER DEFAULT 0,
  learning_engagement_score INTEGER DEFAULT 0,
  quiz_score INTEGER DEFAULT 0,
  practical_score INTEGER DEFAULT 0, -- Based on KPIs
  last_calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, competency_id)
);

-- 9. Learning Badges
CREATE TABLE public.coach_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  badge_color TEXT DEFAULT '#FFD700',
  criteria_type TEXT NOT NULL, -- 'quiz_count', 'learning_streak', 'competency_mastery', 'content_completion'
  criteria_value INTEGER NOT NULL,
  criteria_competency_id UUID REFERENCES public.coach_competencies(id), -- Optional: for competency-specific badges
  points_awarded INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. User Earned Badges
CREATE TABLE public.coach_user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_id UUID REFERENCES public.coach_badges(id),
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- 11. Learning Streaks
CREATE TABLE public.coach_user_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  total_learning_days INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 12. Daily Nudges/Recommendations
CREATE TABLE public.coach_daily_nudges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nudge_type TEXT NOT NULL, -- 'quiz', 'learning', 'scenario', 'tip', 'feedback_request'
  reference_id UUID, -- Reference to content, quiz, or scenario
  message TEXT,
  is_delivered BOOLEAN DEFAULT false,
  is_interacted BOOLEAN DEFAULT false,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 13. AI Coach Feedback
CREATE TABLE public.coach_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reference_type TEXT NOT NULL, -- 'learning_content', 'quiz', 'scenario', 'recommendation', 'coach_interaction'
  reference_id UUID,
  rating INTEGER, -- 1-5
  is_helpful BOOLEAN,
  feedback_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 14. Coach Chat History (for conversational UI)
CREATE TABLE public.coach_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL,
  role TEXT NOT NULL, -- 'user', 'coach'
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'quiz', 'scenario', 'recommendation', 'tip'
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 15. User Overall Learning Score
CREATE TABLE public.coach_user_overall_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  overall_learning_score INTEGER DEFAULT 0, -- 0-100
  overall_competency_score INTEGER DEFAULT 0, -- 0-100
  total_points_earned INTEGER DEFAULT 0,
  total_content_completed INTEGER DEFAULT 0,
  total_quizzes_attempted INTEGER DEFAULT 0,
  total_correct_answers INTEGER DEFAULT 0,
  total_scenarios_completed INTEGER DEFAULT 0,
  rank_percentile INTEGER, -- User's rank percentile
  last_calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.coach_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_learning_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_scenario_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_user_competency_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_daily_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_user_overall_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for master tables (read-only for authenticated users)
CREATE POLICY "Anyone can view competencies" ON public.coach_competencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view learning content" ON public.coach_learning_content FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view quiz questions" ON public.coach_quiz_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view scenarios" ON public.coach_scenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view badges" ON public.coach_badges FOR SELECT TO authenticated USING (true);

-- RLS Policies for user-specific tables
CREATE POLICY "Users can view own progress" ON public.coach_user_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.coach_user_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.coach_user_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own quiz attempts" ON public.coach_quiz_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quiz attempts" ON public.coach_quiz_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own scenario attempts" ON public.coach_scenario_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scenario attempts" ON public.coach_scenario_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own competency scores" ON public.coach_user_competency_scores FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own competency scores" ON public.coach_user_competency_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own competency scores" ON public.coach_user_competency_scores FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own badges" ON public.coach_user_badges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own badges" ON public.coach_user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own streaks" ON public.coach_user_streaks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own streaks" ON public.coach_user_streaks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streaks" ON public.coach_user_streaks FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own nudges" ON public.coach_daily_nudges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own nudges" ON public.coach_daily_nudges FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback" ON public.coach_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feedback" ON public.coach_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own chat messages" ON public.coach_chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat messages" ON public.coach_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own overall scores" ON public.coach_user_overall_scores FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own overall scores" ON public.coach_user_overall_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own overall scores" ON public.coach_user_overall_scores FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Insert default competencies based on the framework
INSERT INTO public.coach_competencies (name, description, category, icon, sort_order) VALUES
('Product Knowledge & Pitching', 'Master product features, benefits, and effective pitching techniques', 'Core Sales Skills', '📦', 1),
('Territory & Beat Planning', 'Optimize route planning and territory coverage for maximum efficiency', 'Planning & Strategy', '🗺️', 2),
('Relationship Building & Customer Engagement', 'Build lasting relationships and engage customers effectively', 'Relationship Skills', '🤝', 3),
('Objection Handling & Closing', 'Handle customer objections and close deals successfully', 'Sales Techniques', '🎯', 4),
('Digital Tool Adoption & Reporting', 'Effectively use digital tools and maintain accurate reports', 'Digital Skills', '📱', 5),
('Compliance & SOP Adherence', 'Follow standard operating procedures and maintain compliance', 'Operations', '✅', 6),
('Time Management & Productivity', 'Manage time effectively to maximize daily productivity', 'Personal Effectiveness', '⏰', 7);

-- Insert sample learning content
INSERT INTO public.coach_learning_content (title, description, content_type, duration_minutes, difficulty_level, competency_id, points_on_completion) 
SELECT 
  'Introduction to ' || name,
  'Learn the fundamentals of ' || lower(name),
  'video',
  15,
  'beginner',
  id,
  20
FROM public.coach_competencies;

-- Insert sample badges
INSERT INTO public.coach_badges (name, description, icon, criteria_type, criteria_value, points_awarded) VALUES
('Quiz Champion', 'Answer 50 quiz questions correctly', '🏆', 'quiz_count', 50, 100),
('Consistent Learner', 'Maintain a 7-day learning streak', '🔥', 'learning_streak', 7, 75),
('Fast Starter', 'Complete your first learning module', '🚀', 'content_completion', 1, 25),
('Knowledge Seeker', 'Complete 10 learning modules', '📚', 'content_completion', 10, 150),
('Scenario Master', 'Complete 20 scenario challenges', '🎭', 'scenario_completion', 20, 100),
('Perfect Score', 'Get 100% in any quiz', '⭐', 'perfect_quiz', 1, 50);

-- Insert sample quiz questions
INSERT INTO public.coach_quiz_questions (question, question_type, options, correct_answer, explanation, competency_id, difficulty_level, points)
SELECT 
  'What is the most important aspect of ' || lower(name) || '?',
  'multiple_choice',
  '["Understanding customer needs", "Talking non-stop about features", "Ignoring customer feedback", "Focusing only on price"]'::jsonb,
  'Understanding customer needs',
  'Understanding customer needs is fundamental to all successful sales interactions.',
  id,
  'beginner',
  5
FROM public.coach_competencies;

-- Insert sample scenarios
INSERT INTO public.coach_scenarios (title, scenario_text, scenario_type, options, best_option, feedback, competency_id, difficulty_level, points)
VALUES (
  'The Price Objection',
  'A customer says: "Your product is too expensive compared to competitors." How do you respond?',
  'objection_handling',
  '["Immediately offer a discount", "Highlight the unique value and ROI", "Agree and walk away", "Criticize the competitor"]'::jsonb,
  'Highlight the unique value and ROI',
  '{"option1": "Discounting too quickly reduces perceived value and profits.", "option2": "Excellent! Focusing on value helps justify the price.", "option3": "Never give up on a potential sale without trying.", "option4": "Criticizing competitors is unprofessional."}'::jsonb,
  (SELECT id FROM public.coach_competencies WHERE name LIKE '%Objection%' LIMIT 1),
  'intermediate',
  15
);