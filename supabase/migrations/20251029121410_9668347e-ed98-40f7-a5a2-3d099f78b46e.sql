-- Add face verification columns to attendance table
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS face_verification_status TEXT CHECK (face_verification_status IN ('match', 'partial', 'nomatch', 'error')),
ADD COLUMN IF NOT EXISTS face_match_confidence DECIMAL(5,2);