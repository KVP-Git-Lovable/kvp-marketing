
-- Add RLS policy to allow authenticated users to view attendance for reporting
-- This enables managers to see their team's attendance data in analytics

CREATE POLICY "Authenticated users can view attendance for reporting"
ON public.attendance
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

-- Add RLS policy to allow authenticated users to view retailer visit logs for reporting
-- This enables managers to see their team's market hours data in analytics

CREATE POLICY "Authenticated users can view visit logs for reporting"
ON public.retailer_visit_logs
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');
