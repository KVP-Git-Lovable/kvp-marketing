-- Add new status options and business details columns to distributors table
ALTER TABLE distributors 
ADD COLUMN IF NOT EXISTS distributor_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS established_year integer,
ADD COLUMN IF NOT EXISTS products_distributed text[],
ADD COLUMN IF NOT EXISTS other_products text[],
ADD COLUMN IF NOT EXISTS assets_trucks integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS assets_vans integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_team_size integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS coverage_area text,
ADD COLUMN IF NOT EXISTS annual_revenue numeric,
ADD COLUMN IF NOT EXISTS profitability text,
ADD COLUMN IF NOT EXISTS business_hunger text,
ADD COLUMN IF NOT EXISTS about_business text;

-- Create distributor contacts table
CREATE TABLE IF NOT EXISTS distributor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid REFERENCES distributors(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  designation text,
  phone text,
  email text,
  address text,
  is_primary boolean DEFAULT false,
  reports_to uuid REFERENCES distributor_contacts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create distributor locations table
CREATE TABLE IF NOT EXISTS distributor_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid REFERENCES distributors(id) ON DELETE CASCADE,
  location_name text NOT NULL,
  address text,
  city text,
  state text,
  pincode text,
  is_head_office boolean DEFAULT false,
  contact_phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create distributor attachments table
CREATE TABLE IF NOT EXISTS distributor_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid REFERENCES distributors(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Add business details columns to vendors (super stockists) table
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS stockist_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS established_year integer,
ADD COLUMN IF NOT EXISTS products_distributed text[],
ADD COLUMN IF NOT EXISTS other_products text[],
ADD COLUMN IF NOT EXISTS assets_trucks integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS assets_vans integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_team_size integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS coverage_area text,
ADD COLUMN IF NOT EXISTS annual_revenue numeric,
ADD COLUMN IF NOT EXISTS profitability text,
ADD COLUMN IF NOT EXISTS business_hunger text,
ADD COLUMN IF NOT EXISTS about_business text;

-- Create super stockist contacts table
CREATE TABLE IF NOT EXISTS stockist_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stockist_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  designation text,
  phone text,
  email text,
  address text,
  is_primary boolean DEFAULT false,
  reports_to uuid REFERENCES stockist_contacts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create super stockist locations table
CREATE TABLE IF NOT EXISTS stockist_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stockist_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  location_name text NOT NULL,
  address text,
  city text,
  state text,
  pincode text,
  is_head_office boolean DEFAULT false,
  contact_phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create super stockist attachments table
CREATE TABLE IF NOT EXISTS stockist_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stockist_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE distributor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributor_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributor_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stockist_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stockist_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stockist_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for distributor_contacts
CREATE POLICY "Authenticated users can view distributor contacts" ON distributor_contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert distributor contacts" ON distributor_contacts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update distributor contacts" ON distributor_contacts
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete distributor contacts" ON distributor_contacts
  FOR DELETE TO authenticated USING (true);

-- Create RLS policies for distributor_locations
CREATE POLICY "Authenticated users can view distributor locations" ON distributor_locations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert distributor locations" ON distributor_locations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update distributor locations" ON distributor_locations
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete distributor locations" ON distributor_locations
  FOR DELETE TO authenticated USING (true);

-- Create RLS policies for distributor_attachments
CREATE POLICY "Authenticated users can view distributor attachments" ON distributor_attachments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert distributor attachments" ON distributor_attachments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update distributor attachments" ON distributor_attachments
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete distributor attachments" ON distributor_attachments
  FOR DELETE TO authenticated USING (true);

-- Create RLS policies for stockist_contacts
CREATE POLICY "Authenticated users can view stockist contacts" ON stockist_contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stockist contacts" ON stockist_contacts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stockist contacts" ON stockist_contacts
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete stockist contacts" ON stockist_contacts
  FOR DELETE TO authenticated USING (true);

-- Create RLS policies for stockist_locations
CREATE POLICY "Authenticated users can view stockist locations" ON stockist_locations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stockist locations" ON stockist_locations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stockist locations" ON stockist_locations
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete stockist locations" ON stockist_locations
  FOR DELETE TO authenticated USING (true);

-- Create RLS policies for stockist_attachments
CREATE POLICY "Authenticated users can view stockist attachments" ON stockist_attachments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stockist attachments" ON stockist_attachments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stockist attachments" ON stockist_attachments
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete stockist attachments" ON stockist_attachments
  FOR DELETE TO authenticated USING (true);