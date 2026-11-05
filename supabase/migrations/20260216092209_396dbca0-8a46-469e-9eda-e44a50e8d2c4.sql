
-- Seed feature_flags for all navigation modules (all enabled by default)
INSERT INTO public.feature_flags (feature_key, feature_name, description, category, is_enabled)
VALUES
  ('attendance', 'Attendance', 'Attendance check-in/check-out module', 'navigation', true),
  ('my_visit', 'My Visit', 'Visit management and retailer visits', 'navigation', true),
  ('all_retailers', 'All Retailers', 'View and manage all retailers', 'navigation', true),
  ('my_target', 'My Target', 'View personal sales targets', 'navigation', true),
  ('target_vs_actual', 'Target Vs Actual', 'Performance dashboard comparing targets to actuals', 'navigation', true),
  ('analytics', 'Analytics', 'Sales and performance analytics', 'navigation', true),
  ('institutional_sales', 'Institutional Sales', 'Institutional/B2B sales module', 'navigation', true),
  ('distributor_master', 'Distributor Master', 'Distributor management', 'navigation', true),
  ('primary_orders', 'Primary Orders', 'Primary order placement', 'navigation', true),
  ('territories', 'Territories', 'Territory and distributor management', 'navigation', true),
  ('gps_track', 'GPS Track', 'GPS tracking and journey playback', 'navigation', true),
  ('my_beats', 'My Beats', 'Beat route management', 'navigation', true),
  ('competition_master', 'Competition Master', 'Competition tracking', 'navigation', true),
  ('schemes', 'Schemes', 'Product schemes and offers', 'navigation', true),
  ('expenses', 'Expenses', 'Expense management and claims', 'navigation', true),
  ('gamification', 'Gamification / Leaderboard', 'Gamification and leaderboard features', 'navigation', true),
  ('competency', 'My Competency', 'Competency dashboard and assessments', 'navigation', true),
  ('recycle_bin', 'Recycle Bin', 'Deleted items recovery', 'navigation', true)
ON CONFLICT (feature_key) DO NOTHING;
