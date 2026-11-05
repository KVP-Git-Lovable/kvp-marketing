-- Create SMS/Twilio configuration table
CREATE TABLE IF NOT EXISTS public.sms_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'twilio',
  account_sid text,
  auth_token text,
  from_number text,
  whatsapp_number text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage SMS config
CREATE POLICY "Admins can manage SMS config"
ON public.sms_config
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Insert default row
INSERT INTO public.sms_config (provider, is_active)
VALUES ('twilio', true)
ON CONFLICT DO NOTHING;