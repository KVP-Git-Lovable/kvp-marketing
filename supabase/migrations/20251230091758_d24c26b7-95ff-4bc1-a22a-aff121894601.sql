-- Add band column to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS band integer;

-- Add check constraint for band values 1-5
ALTER TABLE public.employees ADD CONSTRAINT employees_band_check CHECK (band IS NULL OR (band >= 1 AND band <= 5));

-- Create profile_attachments table for storing user file attachments
CREATE TABLE public.profile_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  description TEXT,
  attached_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profile_attachments
ALTER TABLE public.profile_attachments ENABLE ROW LEVEL SECURITY;

-- Users can view their own attachments
CREATE POLICY "Users can view their own attachments"
ON public.profile_attachments
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create attachments for themselves
CREATE POLICY "Users can create their own attachments"
ON public.profile_attachments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own attachments
CREATE POLICY "Users can update their own attachments"
ON public.profile_attachments
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own attachments
CREATE POLICY "Users can delete their own attachments"
ON public.profile_attachments
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_profile_attachments_user_id ON public.profile_attachments(user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_profile_attachments_updated_at
BEFORE UPDATE ON public.profile_attachments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create social_post_attachments table for multiple file attachments to posts
CREATE TABLE public.social_post_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_post_attachments ENABLE ROW LEVEL SECURITY;

-- Everyone can view post attachments
CREATE POLICY "Anyone can view post attachments"
ON public.social_post_attachments
FOR SELECT
USING (true);

-- Users can create attachments for their posts
CREATE POLICY "Users can create post attachments"
ON public.social_post_attachments
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM social_posts 
  WHERE id = post_id AND user_id = auth.uid()
));

-- Users can delete their post attachments
CREATE POLICY "Users can delete their post attachments"
ON public.social_post_attachments
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM social_posts 
  WHERE id = post_id AND user_id = auth.uid()
));

-- Create social_reactions table for emoji reactions
CREATE TABLE public.social_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.social_reactions ENABLE ROW LEVEL SECURITY;

-- Everyone can view reactions
CREATE POLICY "Anyone can view reactions"
ON public.social_reactions
FOR SELECT
USING (true);

-- Users can add reactions
CREATE POLICY "Users can add reactions"
ON public.social_reactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove their reactions
CREATE POLICY "Users can remove their reactions"
ON public.social_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_social_post_attachments_post_id ON public.social_post_attachments(post_id);
CREATE INDEX idx_social_reactions_post_id ON public.social_reactions(post_id);