-- Create badges table
CREATE TABLE public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  criteria_type TEXT NOT NULL,
  criteria_value NUMERIC NOT NULL,
  badge_color TEXT DEFAULT 'blue',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_badges table
CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view badges"
  ON public.badges FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage badges"
  ON public.badges FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own badges"
  ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can award badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default badges
INSERT INTO public.badges (name, description, icon, criteria_type, criteria_value, badge_color) VALUES
('First Order', 'Complete your first order', '🎯', 'order_count', 1, 'green'),
('Century', 'Complete 100 orders', '💯', 'order_count', 100, 'gold'),
('Retailer Hunter', 'Add 10 new retailers', '🏪', 'retailer_count', 10, 'blue'),
('Retailer Master', 'Add 50 new retailers', '🏬', 'retailer_count', 50, 'purple'),
('Top Performer', 'Rank #1 for a month', '👑', 'rank_top', 1, 'gold'),
('Consistent Star', 'Top 10 for 3 months', '⭐', 'top_10_months', 3, 'silver'),
('Revenue King', 'Generate ₹1 Lakh revenue', '💰', 'revenue', 100000, 'gold'),
('Intelligence Agent', 'Submit 20 competition insights', '🕵️', 'insights_count', 20, 'blue');