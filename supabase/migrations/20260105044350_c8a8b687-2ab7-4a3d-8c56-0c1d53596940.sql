-- Fix Security Definer View issue by recreating views with security_invoker = true
-- This ensures views respect RLS policies of the querying user

-- 1. Drop and recreate orders_total_amount view
DROP VIEW IF EXISTS public.orders_total_amount;
CREATE VIEW public.orders_total_amount WITH (security_invoker = true) AS
SELECT total_amount FROM orders;

-- 2. Drop and recreate productive_summary_daywise view
DROP VIEW IF EXISTS public.productive_summary_daywise;
CREATE VIEW public.productive_summary_daywise WITH (security_invoker = true) AS
SELECT 
    to_char((planned_date)::timestamp with time zone, 'FMMonth DD, YYYY'::text) AS planned_date,
    count(CASE WHEN (status = 'productive'::text) THEN 1 ELSE NULL::integer END) AS productive_visits,
    count(CASE WHEN (status = 'unproductive'::text) THEN 1 ELSE NULL::integer END) AS unproductive_visits,
    count(id) AS total_visits,
    round((((count(CASE WHEN (status = 'productive'::text) THEN 1 ELSE NULL::integer END))::numeric / (NULLIF(count(id), 0))::numeric) * (100)::numeric), 2) AS productivity_percentage
FROM visits v
WHERE ((status = ANY (ARRAY['productive'::text, 'unproductive'::text])) AND ((planned_date >= '2025-12-01'::date) AND (planned_date <= '2025-12-26'::date)))
GROUP BY planned_date
ORDER BY v.planned_date DESC;

-- 3. Drop and recreate productive_summary_week view
DROP VIEW IF EXISTS public.productive_summary_week;
CREATE VIEW public.productive_summary_week WITH (security_invoker = true) AS
SELECT 
    to_char((planned_date)::timestamp with time zone, 'FMMonth DD, YYYY'::text) AS planned_date,
    count(CASE WHEN (status = 'productive'::text) THEN 1 ELSE NULL::integer END) AS productive_visits,
    count(CASE WHEN (status = 'unproductive'::text) THEN 1 ELSE NULL::integer END) AS unproductive_visits,
    count(id) AS total_visits,
    round((((count(CASE WHEN (status = 'productive'::text) THEN 1 ELSE NULL::integer END))::numeric / (NULLIF(count(id), 0))::numeric) * (100)::numeric), 2) AS productivity_percentage
FROM visits v
WHERE ((status = ANY (ARRAY['productive'::text, 'unproductive'::text])) AND ((planned_date >= '2025-12-15'::date) AND (planned_date <= '2025-12-26'::date)))
GROUP BY planned_date
ORDER BY v.planned_date DESC;

-- 4. Drop and recreate productive_view view
DROP VIEW IF EXISTS public.productive_view;
CREATE VIEW public.productive_view WITH (security_invoker = true) AS
SELECT 
    p.full_name,
    count(CASE WHEN (v.status = 'productive'::text) THEN 1 ELSE NULL::integer END) AS productive_visits,
    count(v.id) AS total_visits,
    round((((count(CASE WHEN (v.status = 'productive'::text) THEN 1 ELSE NULL::integer END))::numeric / (NULLIF(count(v.id), 0))::numeric) * (100)::numeric), 2) AS productivity_percentage
FROM (visits v LEFT JOIN profiles p ON ((v.user_id = p.id)))
WHERE ((v.status = ANY (ARRAY['productive'::text, 'unproductive'::text])) AND ((v.planned_date >= '2025-12-01'::date) AND (v.planned_date <= '2025-12-26'::date)))
GROUP BY p.full_name;

-- 5. Drop and recreate retailer_loyalty_balance view
DROP VIEW IF EXISTS public.retailer_loyalty_balance;
CREATE VIEW public.retailer_loyalty_balance WITH (security_invoker = true) AS
SELECT 
    retailer_id,
    COALESCE(sum(points), (0)::numeric) AS total_points,
    count(*) AS total_transactions
FROM retailer_loyalty_points
GROUP BY retailer_id;