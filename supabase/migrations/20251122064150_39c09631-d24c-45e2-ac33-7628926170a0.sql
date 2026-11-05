-- Add territory_id to beats table
ALTER TABLE beats ADD COLUMN territory_id UUID REFERENCES territories(id);

-- Create index for better performance
CREATE INDEX idx_beats_territory_id ON beats(territory_id);