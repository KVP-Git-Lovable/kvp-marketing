CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'auto-end-day-check',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://etabpbfokzhhfuybeieu.supabase.co/functions/v1/auto-end-day',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0YWJwYmZva3poaGZ1eWJlaWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNDE3MzQsImV4cCI6MjA2OTYxNzczNH0.AO6uAyehyNgwt37xC8qnFkAObSYzWW7Dt-uDpSCnsDA"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);