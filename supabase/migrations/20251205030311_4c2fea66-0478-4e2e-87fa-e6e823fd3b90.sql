-- Create recycle bin table to store deleted items
CREATE TABLE public.recycle_bin (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_table TEXT NOT NULL,
  original_id UUID NOT NULL,
  record_data JSONB NOT NULL,
  deleted_by UUID NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  module_name TEXT NOT NULL,
  record_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create permanent deletion log for audit
CREATE TABLE public.permanent_deletion_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_table TEXT NOT NULL,
  original_id UUID NOT NULL,
  record_data JSONB NOT NULL,
  module_name TEXT NOT NULL,
  record_name TEXT,
  deleted_from_bin_by UUID NOT NULL,
  deleted_from_bin_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  original_deleted_by UUID NOT NULL,
  original_deleted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recycle bin config for admin settings
CREATE TABLE public.recycle_bin_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auto_delete_days INTEGER DEFAULT 30,
  is_enabled BOOLEAN DEFAULT true,
  show_deletion_log_to_users BOOLEAN DEFAULT false,
  require_confirmation BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default config
INSERT INTO public.recycle_bin_config (auto_delete_days, is_enabled, show_deletion_log_to_users, require_confirmation)
VALUES (30, true, false, true);

-- Enable RLS
ALTER TABLE public.recycle_bin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permanent_deletion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recycle_bin_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recycle_bin
CREATE POLICY "Users can view their deleted items"
ON public.recycle_bin FOR SELECT
USING (auth.uid() = deleted_by OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete their items from bin"
ON public.recycle_bin FOR DELETE
USING (auth.uid() = deleted_by OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert into recycle bin"
ON public.recycle_bin FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for permanent_deletion_log
CREATE POLICY "Admins can view deletion log"
ON public.permanent_deletion_log FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert deletion log"
ON public.permanent_deletion_log FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for recycle_bin_config
CREATE POLICY "Admins can manage recycle bin config"
ON public.recycle_bin_config FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view recycle bin config"
ON public.recycle_bin_config FOR SELECT
USING (auth.uid() IS NOT NULL);