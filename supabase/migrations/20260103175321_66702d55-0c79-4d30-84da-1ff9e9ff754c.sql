-- Create AI insights table for proactive AI-generated alerts and recommendations
CREATE TABLE public.ai_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('alert', 'opportunity', 'recommendation', 'kudos', 'reminder')),
  category TEXT NOT NULL CHECK (category IN ('team', 'sales', 'collection', 'retailer', 'beat', 'attendance', 'target', 'distributor')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_type TEXT, -- 'navigate', 'call', 'remind', 'view'
  action_data JSONB, -- {path: '/retailers/123', phone: '+91xxx', etc.}
  reference_id UUID, -- Optional reference to related entity
  reference_type TEXT, -- 'retailer', 'visit', 'order', 'user', etc.
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  is_actioned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_ai_insights_user_id ON public.ai_insights(user_id);
CREATE INDEX idx_ai_insights_user_unread ON public.ai_insights(user_id, is_read) WHERE is_read = false AND is_dismissed = false;
CREATE INDEX idx_ai_insights_priority ON public.ai_insights(priority, created_at DESC);
CREATE INDEX idx_ai_insights_expires ON public.ai_insights(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Users can view their own insights
CREATE POLICY "Users can view own insights"
ON public.ai_insights
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own insights (mark as read/dismissed)
CREATE POLICY "Users can update own insights"
ON public.ai_insights
FOR UPDATE
USING (auth.uid() = user_id);

-- Service role can insert insights (for the AI engine)
CREATE POLICY "Service can insert insights"
ON public.ai_insights
FOR INSERT
WITH CHECK (true);

-- Service role can delete old insights
CREATE POLICY "Service can delete insights"
ON public.ai_insights
FOR DELETE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_insights_updated_at
BEFORE UPDATE ON public.ai_insights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to clean up expired insights (can be called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_insights()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM ai_insights 
  WHERE expires_at IS NOT NULL 
    AND expires_at < now();
  
  -- Also delete old dismissed insights (older than 7 days)
  DELETE FROM ai_insights 
  WHERE is_dismissed = true 
    AND created_at < now() - interval '7 days';
END;
$$;