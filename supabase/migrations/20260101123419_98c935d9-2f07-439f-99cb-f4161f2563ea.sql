-- Create table for tracking AI autonomous actions
CREATE TABLE IF NOT EXISTS public.ai_autonomous_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  action_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  executed_at TIMESTAMP WITH TIME ZONE,
  can_undo BOOLEAN DEFAULT false,
  undo_until TIMESTAMP WITH TIME ZONE,
  undone_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX idx_ai_autonomous_actions_user_id ON public.ai_autonomous_actions(user_id);
CREATE INDEX idx_ai_autonomous_actions_action_type ON public.ai_autonomous_actions(action_type);
CREATE INDEX idx_ai_autonomous_actions_status ON public.ai_autonomous_actions(status);

-- Enable RLS
ALTER TABLE public.ai_autonomous_actions ENABLE ROW LEVEL SECURITY;

-- Users can view their own autonomous actions
CREATE POLICY "Users can view their own autonomous actions" 
ON public.ai_autonomous_actions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can update their own autonomous actions (for undo)
CREATE POLICY "Users can update their own autonomous actions" 
ON public.ai_autonomous_actions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Service role can insert (for edge functions)
CREATE POLICY "Service role can insert autonomous actions" 
ON public.ai_autonomous_actions 
FOR INSERT 
WITH CHECK (true);

-- Create table for user autonomy preferences
CREATE TABLE IF NOT EXISTS public.user_autonomy_settings (
  user_id UUID PRIMARY KEY,
  auto_beat_planning BOOLEAN DEFAULT true,
  auto_order_prefill BOOLEAN DEFAULT true,
  auto_payment_reminders BOOLEAN DEFAULT false,
  auto_escalation BOOLEAN DEFAULT true,
  auto_daily_summary BOOLEAN DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_autonomy_settings ENABLE ROW LEVEL SECURITY;

-- Users can manage their own autonomy settings
CREATE POLICY "Users can manage their own autonomy settings" 
ON public.user_autonomy_settings 
FOR ALL
USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE public.ai_autonomous_actions IS 'Tracks AI-initiated autonomous actions for transparency and undo capability';
COMMENT ON TABLE public.user_autonomy_settings IS 'User preferences for AI autonomy features';