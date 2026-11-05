-- Insert sample distributors with correct status values
INSERT INTO public.distributors (
  id, name, contact_person, phone, email, address, gst_number, 
  distribution_level, status, distributor_status, partnership_status, established_year,
  distribution_experience_years, sales_team_size, network_retailers_count,
  region_coverage, assets_vans, assets_trucks, years_of_relationship,
  strength, weakness, opportunities, threats, about_business
) VALUES 
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Krishna Distributors Pvt Ltd',
  'Ramesh Kumar',
  '+91 9876543210',
  'ramesh@krishnadist.com',
  '45, Industrial Area, Phase 2, Bengaluru - 560058',
  '29AABCK1234F1ZA',
  'Distributor',
  'active',
  'onboarded',
  'Gold',
  2010,
  14,
  12,
  85,
  'Bengaluru South, Bengaluru East',
  5,
  2,
  8,
  'Strong retail network, experienced sales team, good market reputation',
  'Limited cold storage capacity, aging fleet',
  'Expand to new territories, add more product categories',
  'New competitors entering market, rising fuel costs',
  'Krishna Distributors has been a reliable partner for FMCG distribution in South Bengaluru since 2010.'
),
(
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  'Lakshmi Agencies',
  'Suresh Babu',
  '+91 8765432109',
  'suresh@lakshmiagencies.in',
  '12, Main Road, Mangalore - 575001',
  '29AALCL5678G1ZB',
  'Super Stockist',
  'active',
  'onboarded',
  'Platinum',
  2005,
  19,
  25,
  150,
  'Dakshina Kannada, Udupi',
  8,
  4,
  12,
  'Largest network in coastal Karnataka, excellent logistics infrastructure',
  'High operating costs',
  'Rural market penetration, digital transformation',
  'Economic slowdown affecting retail spending',
  'Lakshmi Agencies is a leading super stockist covering the entire coastal Karnataka region.'
);

-- Link distributors to existing retailers
UPDATE public.retailers 
SET distributor_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
WHERE id IN ('66b2c1c3-14f4-4fc6-ae21-0ab06cb05b3c', '1562d5de-df5c-40aa-9a4d-869dbe8106fa');

UPDATE public.retailers 
SET distributor_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012'
WHERE id = 'e91c5019-a3a4-43f4-9085-d6ebef05a046';

-- Link distributors to existing beats
UPDATE public.beats 
SET distributor_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
WHERE id IN ('aab393b1-f3b3-437f-9de3-7bd8427cd3f3', '31b020f1-60a5-40ee-b9b1-532a12bd8965');

UPDATE public.beats 
SET distributor_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012'
WHERE id = 'dd779ca9-08ee-42fd-b7c5-2632b4bcd04b';

-- Add sample contacts for distributors
INSERT INTO public.distributor_contacts (
  distributor_id, contact_name, role, designation, phone, email, is_primary,
  years_of_experience, years_with_distributor
) VALUES 
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Ramesh Kumar',
  'Owner',
  'Managing Director',
  '+91 9876543210',
  'ramesh@krishnadist.com',
  true,
  20,
  14
),
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Priya Sharma',
  'Sales Manager',
  'Regional Sales Head',
  '+91 9876543211',
  'priya@krishnadist.com',
  false,
  10,
  5
),
(
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  'Suresh Babu',
  'Owner',
  'Director',
  '+91 8765432109',
  'suresh@lakshmiagencies.in',
  true,
  25,
  19
);