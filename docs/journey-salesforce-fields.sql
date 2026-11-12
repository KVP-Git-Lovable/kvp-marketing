-- Optional Salesforce-style planning fields on a journey. Informational only; the sending engine never reads them.
alter table public.journeys
  add column if not exists owner_id uuid,
  add column if not exists expected_revenue numeric,
  add column if not exists expected_response_pct numeric;
