-- Add preferred_language column to profiles table
ALTER TABLE profiles 
ADD COLUMN preferred_language VARCHAR(5) DEFAULT 'en';

-- Create index for better performance
CREATE INDEX idx_profiles_preferred_language ON profiles(preferred_language);

-- Add comment for documentation
COMMENT ON COLUMN profiles.preferred_language IS 'User preferred language code (en, hi, kn, ta, te)';
