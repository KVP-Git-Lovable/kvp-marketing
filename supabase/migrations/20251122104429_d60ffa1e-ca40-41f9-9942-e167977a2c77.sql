-- Create retailer loyalty feedback table to track FSE feedback on loyalty actions
CREATE TABLE public.retailer_loyalty_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES public.retailer_loyalty_actions(id) ON DELETE CASCADE,
  fse_user_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
  feedback_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.retailer_loyalty_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for loyalty feedback
CREATE POLICY "FSE users can view their own feedback"
ON public.retailer_loyalty_feedback
FOR SELECT
USING (auth.uid() = fse_user_id);

CREATE POLICY "FSE users can insert their own feedback"
ON public.retailer_loyalty_feedback
FOR INSERT
WITH CHECK (auth.uid() = fse_user_id);

-- Create index for better query performance
CREATE INDEX idx_loyalty_feedback_action ON public.retailer_loyalty_feedback(action_id);
CREATE INDEX idx_loyalty_feedback_user ON public.retailer_loyalty_feedback(fse_user_id);
CREATE INDEX idx_loyalty_feedback_date ON public.retailer_loyalty_feedback(feedback_date);