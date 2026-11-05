-- Create support_requests table
CREATE TABLE public.support_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  support_category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  target_date DATE,
  resolved_date TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own support requests
CREATE POLICY "Users can view their own support requests"
ON public.support_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own support requests
CREATE POLICY "Users can create their own support requests"
ON public.support_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending support requests
CREATE POLICY "Users can update their own support requests"
ON public.support_requests
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view and manage all support requests
CREATE POLICY "Admins can manage all support requests"
ON public.support_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_support_requests_updated_at
BEFORE UPDATE ON public.support_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();