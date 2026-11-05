-- Add indexes to speed up retailer queries for large datasets (10,000+ retailers)
-- These indexes improve performance for common filtering and sync operations

-- Index for filtering retailers by user and beat (most common filter)
CREATE INDEX IF NOT EXISTS idx_retailers_user_beat 
ON public.retailers(user_id, beat_id);

-- Index for filtering retailers by user and status (for active retailers)
CREATE INDEX IF NOT EXISTS idx_retailers_user_status 
ON public.retailers(user_id, status);

-- Index for filtering retailers by user and category
CREATE INDEX IF NOT EXISTS idx_retailers_user_category 
ON public.retailers(user_id, category);

-- Index for visits by user and date (for daily visit loading)
CREATE INDEX IF NOT EXISTS idx_visits_user_date 
ON public.visits(user_id, planned_date);

-- Index for orders by user and date (for daily order loading)
CREATE INDEX IF NOT EXISTS idx_orders_user_date 
ON public.orders(user_id, order_date);

-- Index for beat plans by user and date
CREATE INDEX IF NOT EXISTS idx_beat_plans_user_date 
ON public.beat_plans(user_id, plan_date);