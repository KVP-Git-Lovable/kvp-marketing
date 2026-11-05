-- Create branding workflow schema

-- 1) Enum for branding request status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'branding_status') THEN
    CREATE TYPE public.branding_status AS ENUM (
      'submitted',          -- Sales submitted
      'manager_approved',   -- Approved by manager
      'manager_rejected',   -- Rejected by manager
      'assigned',           -- Vendor assigned by procurement
      'in_progress',        -- Vendor executing
      'executed',           -- Execution completed by vendor
      'verified'            -- Sales verified with photo
    );
  END IF;
END$$;

-- 2) Vendors master
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  contact_phone text,
  contact_email text,
  skills text[] NOT NULL DEFAULT '{}',
  region_pincodes text[] NOT NULL DEFAULT '{}',
  city text,
  state text,
  is_approved boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Admins manage vendors
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendors' AND policyname = 'Admins can manage vendors'
  ) THEN
    CREATE POLICY "Admins can manage vendors"
    ON public.vendors
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Authenticated users can view vendors
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendors' AND policyname = 'Vendors are viewable by authenticated users'
  ) THEN
    CREATE POLICY "Vendors are viewable by authenticated users"
    ON public.vendors
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

-- 3) Branding requests table
CREATE TABLE IF NOT EXISTS public.branding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,             -- Sales user
  retailer_id uuid NOT NULL,         -- Target retailer
  visit_id uuid NOT NULL,            -- Visit context
  title text,
  description text,
  pincode text,
  requested_assets text,             -- e.g., wall, glow sign, shelf strip
  size text,                         -- dimensions if relevant
  budget numeric,
  status public.branding_status NOT NULL DEFAULT 'submitted',
  manager_id uuid,                   -- Approver
  manager_comments text,
  approved_at timestamptz,
  procurement_id uuid,               -- Procurement owner
  assigned_vendor_id uuid REFERENCES public.vendors(id),
  due_date date,
  executed_at timestamptz,
  verification_photo_url text,       -- Sales verification photo
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branding_requests ENABLE ROW LEVEL SECURITY;

-- Policies for branding_requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'branding_requests' AND policyname = 'Users can create their own branding requests'
  ) THEN
    CREATE POLICY "Users can create their own branding requests"
    ON public.branding_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'branding_requests' AND policyname = 'Users and assigned staff can view branding requests'
  ) THEN
    CREATE POLICY "Users and assigned staff can view branding requests"
    ON public.branding_requests
    FOR SELECT
    USING (
      auth.uid() = user_id OR
      auth.uid() = manager_id OR
      auth.uid() = procurement_id OR
      has_role(auth.uid(), 'admin'::app_role)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'branding_requests' AND policyname = 'Users and assigned staff can update branding requests'
  ) THEN
    CREATE POLICY "Users and assigned staff can update branding requests"
    ON public.branding_requests
    FOR UPDATE
    USING (
      auth.uid() = user_id OR
      auth.uid() = manager_id OR
      auth.uid() = procurement_id OR
      has_role(auth.uid(), 'admin'::app_role)
    );
  END IF;
END $$;

-- 4) Triggers for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_vendors_updated_at'
  ) THEN
    CREATE TRIGGER update_vendors_updated_at
    BEFORE UPDATE ON public.vendors
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_branding_requests_updated_at'
  ) THEN
    CREATE TRIGGER update_branding_requests_updated_at
    BEFORE UPDATE ON public.branding_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 5) Storage bucket for branding photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-photos', 'branding-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Branding photos are viewable by owner or admin'
  ) THEN
    CREATE POLICY "Branding photos are viewable by owner or admin"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'branding-photos' AND (
        auth.uid()::text = (storage.foldername(name))[1] OR
        has_role(auth.uid(), 'admin'::app_role)
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own branding photos'
  ) THEN
    CREATE POLICY "Users can upload their own branding photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'branding-photos' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own branding photos'
  ) THEN
    CREATE POLICY "Users can update their own branding photos"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'branding-photos' AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
      bucket_id = 'branding-photos' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;
