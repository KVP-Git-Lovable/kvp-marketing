-- Create analytics views tracking table
CREATE TABLE public.analytics_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  visit_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_views ENABLE ROW LEVEL SECURITY;

-- Create policies for analytics views
CREATE POLICY "Users can create their own analytics views" 
ON public.analytics_views 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own analytics views" 
ON public.analytics_views 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create analytics likes table for feedback
CREATE TABLE public.analytics_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  page_type TEXT NOT NULL DEFAULT 'general_analytics',
  liked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_likes ENABLE ROW LEVEL SECURITY;

-- Create policies for analytics likes
CREATE POLICY "Users can create their own analytics likes" 
ON public.analytics_likes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own analytics likes" 
ON public.analytics_likes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics likes" 
ON public.analytics_likes 
FOR UPDATE 
USING (auth.uid() = user_id);