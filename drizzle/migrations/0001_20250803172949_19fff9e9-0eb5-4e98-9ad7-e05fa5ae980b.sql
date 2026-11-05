-- Create table for retailer feedback  
CREATE TABLE public.retailer_feedback (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    retailer_id UUID NOT NULL,
    visit_id UUID,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('brand_feedback', 'service_feedback', 'product_feedback')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.retailer_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for retailer feedback
CREATE POLICY "Users can view their own feedback records" 
ON public.retailer_feedback 
FOR SELECT 
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own feedback records" 
ON public.retailer_feedback 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own feedback records" 
ON public.retailer_feedback 
FOR UPDATE 
USING (auth.uid()::text = user_id::text);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_retailer_feedback_updated_at
BEFORE UPDATE ON public.retailer_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for competition insights (since it doesn't exist)
CREATE TABLE public.competition_insights (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    retailer_id UUID NOT NULL,
    visit_id UUID,
    competitor_name TEXT NOT NULL,
    product_category TEXT,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('pricing', 'promotion', 'placement', 'product_availability', 'customer_preference')),
    description TEXT NOT NULL,
    impact_level TEXT CHECK (impact_level IN ('low', 'medium', 'high')),
    action_required BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for competition insights
ALTER TABLE public.competition_insights ENABLE ROW LEVEL SECURITY;

-- Create policies for competition insights
CREATE POLICY "Users can view their own competition insights" 
ON public.competition_insights 
FOR SELECT 
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own competition insights" 
ON public.competition_insights 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own competition insights" 
ON public.competition_insights 
FOR UPDATE 
USING (auth.uid()::text = user_id::text);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_competition_insights_updated_at
BEFORE UPDATE ON public.competition_insights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();