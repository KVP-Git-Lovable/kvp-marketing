-- Enable realtime for social_posts table
ALTER TABLE public.social_posts REPLICA IDENTITY FULL;

-- Add social_posts to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;