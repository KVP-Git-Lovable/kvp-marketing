-- Create table for WhatsApp configuration
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_phone_number TEXT NOT NULL,
  business_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view WhatsApp config
CREATE POLICY "Admins can view WhatsApp config"
  ON public.whatsapp_config
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Only admins can insert WhatsApp config
CREATE POLICY "Admins can insert WhatsApp config"
  ON public.whatsapp_config
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Only admins can update WhatsApp config
CREATE POLICY "Admins can update WhatsApp config"
  ON public.whatsapp_config
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();