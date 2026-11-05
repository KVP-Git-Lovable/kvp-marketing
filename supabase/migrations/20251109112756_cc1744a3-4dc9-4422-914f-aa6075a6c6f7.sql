-- Create gamification_games table
CREATE TABLE public.gamification_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  territories TEXT[] DEFAULT '{}',
  is_all_territories BOOLEAN DEFAULT false,
  baseline_target NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gamification_actions table
CREATE TABLE public.gamification_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.gamification_games(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_name TEXT NOT NULL,
  points NUMERIC NOT NULL DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gamification_points table
CREATE TABLE public.gamification_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.gamification_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action_id UUID NOT NULL REFERENCES public.gamification_actions(id),
  points NUMERIC NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Create gamification_redemptions table
CREATE TABLE public.gamification_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  game_id UUID REFERENCES public.gamification_games(id),
  points_redeemed NUMERIC NOT NULL,
  voucher_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id),
  voucher_code TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gamification_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gamification_games
CREATE POLICY "Admins can manage gamification games"
  ON public.gamification_games FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active games"
  ON public.gamification_games FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- RLS Policies for gamification_actions
CREATE POLICY "Admins can manage gamification actions"
  ON public.gamification_actions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view enabled actions for active games"
  ON public.gamification_actions FOR SELECT
  USING (
    is_enabled = true 
    AND EXISTS (
      SELECT 1 FROM public.gamification_games 
      WHERE id = game_id AND is_active = true
    )
    AND auth.uid() IS NOT NULL
  );

-- RLS Policies for gamification_points
CREATE POLICY "Users can view their own points"
  ON public.gamification_points FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert points"
  ON public.gamification_points FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can view all points"
  ON public.gamification_points FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for gamification_redemptions
CREATE POLICY "Users can create their own redemption requests"
  ON public.gamification_redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own redemptions"
  ON public.gamification_redemptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all redemptions"
  ON public.gamification_redemptions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_gamification_points_user_id ON public.gamification_points(user_id);
CREATE INDEX idx_gamification_points_game_id ON public.gamification_points(game_id);
CREATE INDEX idx_gamification_points_earned_at ON public.gamification_points(earned_at);
CREATE INDEX idx_gamification_redemptions_user_id ON public.gamification_redemptions(user_id);
CREATE INDEX idx_gamification_redemptions_status ON public.gamification_redemptions(status);

-- Create trigger for updated_at
CREATE TRIGGER update_gamification_games_updated_at
  BEFORE UPDATE ON public.gamification_games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gamification_actions_updated_at
  BEFORE UPDATE ON public.gamification_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gamification_redemptions_updated_at
  BEFORE UPDATE ON public.gamification_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();