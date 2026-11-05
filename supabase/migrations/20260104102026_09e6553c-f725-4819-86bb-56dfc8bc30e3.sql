-- Seed Field Sales Executive Competencies
INSERT INTO public.competency_templates (role_type, competency_name, competency_code, description, category, weightage, calculation_formula, icon, sort_order)
VALUES
  ('field_executive', 'Territory Coverage', 'FSE_TERRITORY_COVERAGE', 'Measures how effectively you cover your assigned beats and retailers', 'productivity', 15.00, 
   '{"data_sources": ["beat_plans", "visits"], "formula": "unique_beats_visited / planned_beats * 100", "metrics": ["beats_planned", "beats_visited", "coverage_rate"]}',
   'Map', 1),
   
  ('field_executive', 'Productivity', 'FSE_PRODUCTIVITY', 'Percentage of visits that result in successful orders', 'productivity', 20.00,
   '{"data_sources": ["visits", "orders"], "formula": "productive_visits / total_visits * 100", "metrics": ["total_visits", "productive_visits", "productivity_rate"]}',
   'TrendingUp', 2),
   
  ('field_executive', 'Revenue Achievement', 'FSE_REVENUE', 'Achievement against revenue targets for the period', 'achievement', 25.00,
   '{"data_sources": ["orders", "user_period_targets"], "formula": "actual_revenue / target_revenue * 100", "metrics": ["target_revenue", "actual_revenue", "achievement_rate"]}',
   'IndianRupee', 3),
   
  ('field_executive', 'Visit Discipline', 'FSE_DISCIPLINE', 'Adherence to visit protocols including check-ins, photos, and timing', 'discipline', 15.00,
   '{"data_sources": ["visits", "attendance"], "formula": "(checkin_compliance + photo_compliance + timing_score) / 3", "metrics": ["checkin_rate", "photo_rate", "avg_visit_duration", "on_time_rate"]}',
   'Clock', 4),
   
  ('field_executive', 'Retailer Development', 'FSE_RETAILER_DEV', 'New retailer additions and reactivation of dormant accounts', 'development', 10.00,
   '{"data_sources": ["retailers", "orders"], "formula": "(new_retailers + reactivated_retailers) / target * 100", "metrics": ["new_retailers", "reactivated_retailers", "dormant_converted"]}',
   'UserPlus', 5),
   
  ('field_executive', 'Product Mix', 'FSE_PRODUCT_MIX', 'Selling focus products and maintaining healthy SKU diversity', 'achievement', 10.00,
   '{"data_sources": ["orders", "order_items", "products"], "formula": "(focus_product_revenue / total_revenue * 50) + (unique_skus_sold / target_skus * 50)", "metrics": ["focus_product_revenue", "total_revenue", "unique_skus", "sku_diversity_score"]}',
   'Package', 6),
   
  ('field_executive', 'Collection Efficiency', 'FSE_COLLECTION', 'Timely collection of credit and maintaining healthy DSO', 'discipline', 5.00,
   '{"data_sources": ["orders", "payments"], "formula": "(on_time_collections / total_credit_orders * 100)", "metrics": ["credit_orders", "collected_on_time", "dso_days", "overdue_amount"]}',
   'Wallet', 7);

-- Seed Field Sales Manager Competencies
INSERT INTO public.competency_templates (role_type, competency_name, competency_code, description, category, weightage, calculation_formula, icon, sort_order)
VALUES
  ('field_manager', 'Team Achievement', 'FSM_TEAM_ACHIEVEMENT', 'Overall revenue and target achievement of your team', 'leadership', 25.00,
   '{"data_sources": ["user_performance_scores", "subordinates"], "formula": "avg(team_members.revenue_achievement)", "metrics": ["team_revenue", "team_target", "team_achievement_rate", "members_on_target"]}',
   'Users', 1),
   
  ('field_manager', 'Team Productivity', 'FSM_TEAM_PRODUCTIVITY', 'Average productivity rate across team members', 'leadership', 20.00,
   '{"data_sources": ["visits", "orders", "subordinates"], "formula": "avg(team_members.productivity_rate)", "metrics": ["team_visits", "team_productive_visits", "avg_team_productivity"]}',
   'TrendingUp', 2),
   
  ('field_manager', 'Coaching Effectiveness', 'FSM_COACHING', 'Improvement in team member competency scores after coaching', 'development', 15.00,
   '{"data_sources": ["user_competency_monthly_scores", "competency_coaching_notes"], "formula": "avg(team_improvement_rate)", "metrics": ["coaching_sessions", "members_improved", "avg_score_improvement"]}',
   'GraduationCap', 3),
   
  ('field_manager', 'Planning Excellence', 'FSM_PLANNING', 'Quality of beat plans and adherence to planned coverage', 'discipline', 15.00,
   '{"data_sources": ["beat_plans", "visits"], "formula": "avg(team_coverage_rate)", "metrics": ["plans_created", "plans_executed", "coverage_rate"]}',
   'Calendar', 4),
   
  ('field_manager', 'Talent Development', 'FSM_TALENT', 'Growth in team member performance over time', 'development', 15.00,
   '{"data_sources": ["user_monthly_scorecards"], "formula": "avg(team_score_growth)", "metrics": ["members_growing", "members_declining", "avg_growth_rate"]}',
   'Sparkles', 5),
   
  ('field_manager', 'Coverage Management', 'FSM_COVERAGE', 'Overall territory and beat coverage by the team', 'productivity', 10.00,
   '{"data_sources": ["beats", "visits", "retailers"], "formula": "avg(team_coverage_metrics)", "metrics": ["total_beats", "beats_covered", "retailers_visited", "coverage_rate"]}',
   'MapPin', 6);