-- Add points to rupee conversion field to gamification_games table
ALTER TABLE gamification_games
ADD COLUMN points_to_rupee_conversion numeric DEFAULT 1.0 NOT NULL;