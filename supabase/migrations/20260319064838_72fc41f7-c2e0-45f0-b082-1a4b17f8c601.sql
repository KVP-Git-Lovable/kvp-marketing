
-- Auto End Day Policy table (fully configurable)
CREATE TABLE public.auto_end_day_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_close_time TIME NOT NULL DEFAULT '22:00:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  last_activity_source TEXT NOT NULL DEFAULT 'all_activity',
  pre_warning_enabled BOOLEAN NOT NULL DEFAULT true,
  pre_warning_minutes_before INTEGER NOT NULL DEFAULT 60,
  close_in_progress_visits BOOLEAN NOT NULL DEFAULT true,
  cancel_planned_visits BOOLEAN NOT NULL DEFAULT true,
  mark_unproductive BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auto_end_day_policy ENABLE ROW LEVEL SECURITY;

-- Admin read policy
CREATE POLICY "Authenticated users can read auto_end_day_policy"
  ON public.auto_end_day_policy FOR SELECT TO authenticated USING (true);

-- Admin update policy
CREATE POLICY "Authenticated users can update auto_end_day_policy"
  ON public.auto_end_day_policy FOR UPDATE TO authenticated USING (true);

-- Admin insert policy
CREATE POLICY "Authenticated users can insert auto_end_day_policy"
  ON public.auto_end_day_policy FOR INSERT TO authenticated WITH CHECK (true);

-- Seed default row
INSERT INTO public.auto_end_day_policy (is_enabled, auto_close_time, timezone, last_activity_source, pre_warning_enabled, pre_warning_minutes_before)
VALUES (true, '22:00:00', 'Asia/Kolkata', 'all_activity', true, 60);

-- Add AUTO_DAY_WARNING event type for pre-warning notifications
INSERT INTO notification_event_types (event_code, label, description, is_active)
VALUES ('AUTO_DAY_WARNING', 'Day Auto-Close Warning', 'Triggered before attendance is automatically closed, warning users to check out', true)
ON CONFLICT DO NOTHING;
