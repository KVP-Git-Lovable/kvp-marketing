-- Create expense master config table
CREATE TABLE public.expense_master_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ta_type TEXT NOT NULL DEFAULT 'from_beat' CHECK (ta_type IN ('fixed', 'from_beat')),
  fixed_ta_amount NUMERIC DEFAULT 0,
  da_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_master_config ENABLE ROW LEVEL SECURITY;

-- Admins can manage expense master config
CREATE POLICY "Admins can manage expense master config"
ON public.expense_master_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view expense master config
CREATE POLICY "Users can view expense master config"
ON public.expense_master_config
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert default config
INSERT INTO public.expense_master_config (ta_type, fixed_ta_amount, da_amount)
VALUES ('from_beat', 0, 0);

-- Create trigger for updated_at
CREATE TRIGGER update_expense_master_config_updated_at
BEFORE UPDATE ON public.expense_master_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();