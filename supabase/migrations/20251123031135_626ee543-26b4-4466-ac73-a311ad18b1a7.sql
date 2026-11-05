-- Create social posts table for collaboration
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create social likes table
CREATE TABLE social_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Create social comments table
CREATE TABLE social_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;

-- Policies for social_posts (all authenticated users can view, create, update, delete their own)
CREATE POLICY "Users can view all posts"
ON social_posts FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create their own posts"
ON social_posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
ON social_posts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
ON social_posts FOR DELETE
USING (auth.uid() = user_id);

-- Policies for social_likes
CREATE POLICY "Users can view all likes"
ON social_likes FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create their own likes"
ON social_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
ON social_likes FOR DELETE
USING (auth.uid() = user_id);

-- Policies for social_comments
CREATE POLICY "Users can view all comments"
ON social_comments FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create their own comments"
ON social_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
ON social_comments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON social_comments FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for social posts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('social-posts', 'social-posts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for social posts
CREATE POLICY "Anyone can view social post images"
ON storage.objects FOR SELECT
USING (bucket_id = 'social-posts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can upload their own social post images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'social-posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own social post images"
ON storage.objects FOR DELETE
USING (bucket_id = 'social-posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create indexes for performance
CREATE INDEX idx_social_posts_user_id ON social_posts(user_id);
CREATE INDEX idx_social_posts_created_at ON social_posts(created_at DESC);
CREATE INDEX idx_social_likes_post_id ON social_likes(post_id);
CREATE INDEX idx_social_comments_post_id ON social_comments(post_id);
