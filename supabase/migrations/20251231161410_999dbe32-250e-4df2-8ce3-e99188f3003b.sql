-- Add foreign key constraints for social tables to profiles
-- This ensures the join query works correctly

-- First, check if constraints don't exist before adding them
DO $$ 
BEGIN
  -- social_posts.user_id -> profiles.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'social_posts_user_id_fkey' 
    AND table_name = 'social_posts'
  ) THEN
    ALTER TABLE social_posts 
    ADD CONSTRAINT social_posts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  -- social_likes.user_id -> profiles.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'social_likes_user_id_fkey' 
    AND table_name = 'social_likes'
  ) THEN
    ALTER TABLE social_likes 
    ADD CONSTRAINT social_likes_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  -- social_comments.user_id -> profiles.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'social_comments_user_id_fkey' 
    AND table_name = 'social_comments'
  ) THEN
    ALTER TABLE social_comments 
    ADD CONSTRAINT social_comments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  -- social_reactions.user_id -> profiles.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'social_reactions_user_id_fkey' 
    AND table_name = 'social_reactions'
  ) THEN
    ALTER TABLE social_reactions 
    ADD CONSTRAINT social_reactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;