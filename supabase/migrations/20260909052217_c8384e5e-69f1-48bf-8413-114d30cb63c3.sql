CREATE TABLE public.rb_report_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rb_saved_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  folder_id UUID REFERENCES public.rb_report_folders(id) ON DELETE SET NULL,
  primary_object TEXT NOT NULL,
  related_object TEXT,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  group_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  group_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters JSONB NOT NULL DEFAULT '[]'::jsonb,
  chart_type TEXT NOT NULL DEFAULT 'table',
  display_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rb_report_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report_id UUID NOT NULL REFERENCES public.rb_saved_reports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, report_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rb_report_folders TO authenticated;
GRANT ALL ON public.rb_report_folders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rb_saved_reports TO authenticated;
GRANT ALL ON public.rb_saved_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rb_report_pins TO authenticated;
GRANT ALL ON public.rb_report_pins TO service_role;

ALTER TABLE public.rb_report_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rb_saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rb_report_pins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rb_can_manage_reports()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_system_admin(auth.uid()),
    false
  )
$$;

CREATE POLICY "rb_folders_read" ON public.rb_report_folders FOR SELECT TO authenticated USING (true);
CREATE POLICY "rb_folders_insert" ON public.rb_report_folders FOR INSERT TO authenticated WITH CHECK (public.rb_can_manage_reports());
CREATE POLICY "rb_folders_update" ON public.rb_report_folders FOR UPDATE TO authenticated USING (public.rb_can_manage_reports()) WITH CHECK (public.rb_can_manage_reports());
CREATE POLICY "rb_folders_delete" ON public.rb_report_folders FOR DELETE TO authenticated USING (public.rb_can_manage_reports());

CREATE POLICY "rb_reports_read" ON public.rb_saved_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "rb_reports_insert" ON public.rb_saved_reports FOR INSERT TO authenticated WITH CHECK (public.rb_can_manage_reports());
CREATE POLICY "rb_reports_update" ON public.rb_saved_reports FOR UPDATE TO authenticated USING (public.rb_can_manage_reports()) WITH CHECK (public.rb_can_manage_reports());
CREATE POLICY "rb_reports_delete" ON public.rb_saved_reports FOR DELETE TO authenticated USING (public.rb_can_manage_reports());

CREATE POLICY "rb_pins_own" ON public.rb_report_pins FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER rb_report_folders_updated_at BEFORE UPDATE ON public.rb_report_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER rb_saved_reports_updated_at BEFORE UPDATE ON public.rb_saved_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();