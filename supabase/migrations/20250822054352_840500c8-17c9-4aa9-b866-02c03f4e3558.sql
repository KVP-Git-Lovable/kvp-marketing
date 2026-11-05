-- Create regularization_requests table for attendance corrections
CREATE TABLE public.regularization_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  attendance_date DATE NOT NULL,
  current_check_in_time TIMESTAMP WITH TIME ZONE,
  current_check_out_time TIMESTAMP WITH TIME ZONE,
  requested_check_in_time TIMESTAMP WITH TIME ZONE,
  requested_check_out_time TIMESTAMP WITH TIME ZONE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.regularization_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create their own regularization requests" 
ON public.regularization_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own regularization requests" 
ON public.regularization_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending requests" 
ON public.regularization_requests 
FOR UPDATE 
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can manage all regularization requests" 
ON public.regularization_requests 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_regularization_requests_updated_at
BEFORE UPDATE ON public.regularization_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();