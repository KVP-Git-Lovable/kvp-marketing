CREATE POLICY "Authenticated users can view cancellation logs"
  ON public.order_cancellation_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert cancellation logs"
  ON public.order_cancellation_log FOR INSERT
  TO authenticated WITH CHECK (true);