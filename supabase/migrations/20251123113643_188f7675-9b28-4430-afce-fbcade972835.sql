-- Phase 1: Database Schema Enhancements for Automated Content Generation

-- Extend social_posts table with automation fields
ALTER TABLE public.social_posts
ADD COLUMN IF NOT EXISTS is_automated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.push_content_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS post_metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS scheduled_time timestamp with time zone;

-- Create index for efficient querying of automated posts
CREATE INDEX IF NOT EXISTS idx_social_posts_is_automated ON public.social_posts(is_automated) WHERE is_automated = true;
CREATE INDEX IF NOT EXISTS idx_social_posts_template_id ON public.social_posts(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_time ON public.social_posts(scheduled_time) WHERE scheduled_time IS NOT NULL;

-- Create push_content_execution_log table
CREATE TABLE IF NOT EXISTS public.push_content_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.push_content_templates(id) ON DELETE CASCADE,
  execution_time timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message text,
  post_id uuid REFERENCES public.social_posts(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.push_content_execution_log IS 'Tracks automated content generation attempts for monitoring and debugging';
COMMENT ON COLUMN public.push_content_execution_log.status IS 'Status: success (post created), failed (error occurred), skipped (no data or conditions not met)';

-- Create indexes for execution log
CREATE INDEX idx_execution_log_user_id ON public.push_content_execution_log(user_id);
CREATE INDEX idx_execution_log_template_id ON public.push_content_execution_log(template_id);
CREATE INDEX idx_execution_log_execution_time ON public.push_content_execution_log(execution_time DESC);
CREATE INDEX idx_execution_log_status ON public.push_content_execution_log(status);

-- Enable Row Level Security
ALTER TABLE public.push_content_execution_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_content_execution_log
CREATE POLICY "Users can view their own execution logs"
  ON public.push_content_execution_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all execution logs"
  ON public.push_content_execution_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert execution logs"
  ON public.push_content_execution_log
  FOR INSERT
  WITH CHECK (true);

-- Create function to clean up old execution logs (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_execution_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.push_content_execution_log
  WHERE execution_time < NOW() - INTERVAL '30 days';
END;
$$;

-- Add trigger to update social_posts updated_at when automation fields change
CREATE OR REPLACE FUNCTION public.update_social_posts_automation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_social_posts_automation
  BEFORE UPDATE OF is_automated, template_id, post_metadata, scheduled_time
  ON public.social_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_social_posts_automation_timestamp();