-- Create pincode_master table for India PIN code reference data
CREATE TABLE public.pincode_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officename TEXT NOT NULL,
    territory_po TEXT,
    pincode TEXT NOT NULL,
    district TEXT,
    statename TEXT,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for common lookups
CREATE INDEX idx_pincode_master_pincode ON public.pincode_master(pincode);
CREATE INDEX idx_pincode_master_district ON public.pincode_master(district);
CREATE INDEX idx_pincode_master_statename ON public.pincode_master(statename);

-- Enable RLS
ALTER TABLE public.pincode_master ENABLE ROW LEVEL SECURITY;

-- Read-only policy for all authenticated users (reference data)
CREATE POLICY "Anyone can read pincode_master"
    ON public.pincode_master FOR SELECT
    TO authenticated
    USING (true);

-- Admin-only write policy
CREATE POLICY "Admins can manage pincode_master"
    ON public.pincode_master FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role));