
-- Phase 1a: Add new columns to additional_expenses
ALTER TABLE public.additional_expenses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Phase 1b: Drop existing RLS policies on additional_expenses and recreate
-- First check existing policies and drop them
DROP POLICY IF EXISTS "Users can manage their own expenses" ON public.additional_expenses;
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.additional_expenses;
DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.additional_expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON public.additional_expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.additional_expenses;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.additional_expenses;

-- Enable RLS
ALTER TABLE public.additional_expenses ENABLE ROW LEVEL SECURITY;

-- Users can SELECT their own expenses
CREATE POLICY "Users can view own expenses"
  ON public.additional_expenses FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Managers can SELECT subordinates' expenses
CREATE POLICY "Managers can view subordinate expenses"
  ON public.additional_expenses FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT subordinate_user_id FROM public.get_all_subordinates(auth.uid()) WHERE level > 0
    )
  );

-- Admins can SELECT all expenses
CREATE POLICY "Admins can view all expenses"
  ON public.additional_expenses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can INSERT their own expenses
CREATE POLICY "Users can insert own expenses"
  ON public.additional_expenses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can UPDATE their own draft expenses only
CREATE POLICY "Users can update own draft expenses"
  ON public.additional_expenses FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft')
  WITH CHECK (user_id = auth.uid());

-- Users can submit their own draft expenses (change status from draft to submitted)
CREATE POLICY "Users can submit own expenses"
  ON public.additional_expenses FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft');

-- Managers can update subordinates' submitted expenses (approve/reject)
CREATE POLICY "Managers can approve reject subordinate expenses"
  ON public.additional_expenses FOR UPDATE TO authenticated
  USING (
    status = 'submitted'
    AND user_id IN (
      SELECT subordinate_user_id FROM public.get_all_subordinates(auth.uid()) WHERE level > 0
    )
  );

-- Admins can update any expense
CREATE POLICY "Admins can update all expenses"
  ON public.additional_expenses FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can DELETE their own draft expenses only
CREATE POLICY "Users can delete own draft expenses"
  ON public.additional_expenses FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft');

-- Admins can delete any expense
CREATE POLICY "Admins can delete all expenses"
  ON public.additional_expenses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
