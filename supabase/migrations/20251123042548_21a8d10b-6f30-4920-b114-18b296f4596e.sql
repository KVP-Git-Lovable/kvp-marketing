-- Create push content templates table for admin-defined templates
CREATE TABLE IF NOT EXISTS push_content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'day_summary', 'next_day_plan', 'weekly_update', 'expense_report', 'performance', 'top_retailers', 'focused_products', 'high_value_orders'
  description TEXT,
  content_structure JSONB NOT NULL, -- Stores the template structure
  default_schedule_time TIME,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user push content subscriptions table
CREATE TABLE IF NOT EXISTS user_push_content_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES push_content_templates(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  schedule_time TIME NOT NULL,
  custom_settings JSONB, -- User-specific settings like performance period, order value threshold
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, template_id)
);

-- Create auto-generated posts table for push content
CREATE TABLE IF NOT EXISTS push_content_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES push_content_templates(id),
  subscription_id UUID REFERENCES user_push_content_subscriptions(id),
  content TEXT NOT NULL,
  generated_data JSONB, -- Stores the actual data used to generate the post
  posted_at TIMESTAMPTZ DEFAULT now(),
  is_published BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE push_content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_push_content_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_content_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_content_templates
CREATE POLICY "Admins can manage push content templates"
  ON push_content_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active templates"
  ON push_content_templates FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- RLS Policies for user_push_content_subscriptions
CREATE POLICY "Users can manage their own subscriptions"
  ON user_push_content_subscriptions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON user_push_content_subscriptions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for push_content_posts
CREATE POLICY "Users can view their own push content posts"
  ON push_content_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create push content posts"
  ON push_content_posts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_user_push_subscriptions_user ON user_push_content_subscriptions(user_id);
CREATE INDEX idx_user_push_subscriptions_template ON user_push_content_subscriptions(template_id);
CREATE INDEX idx_push_content_posts_user ON push_content_posts(user_id);
CREATE INDEX idx_push_content_posts_posted_at ON push_content_posts(posted_at);

-- Insert default push content templates
INSERT INTO push_content_templates (template_name, template_type, description, content_structure, default_schedule_time) VALUES
('My Day Summary', 'day_summary', 'Daily summary of your activities, visits, and orders', '{"sections": ["visits", "orders", "expenses", "distance_traveled"]}', '18:00:00'),
('Next Day Plan', 'next_day_plan', 'Your plan for tomorrow including scheduled visits and beats', '{"sections": ["scheduled_visits", "beat_plan", "reminders"]}', '19:00:00'),
('This Week Update', 'weekly_update', 'Weekly performance summary and achievements', '{"sections": ["total_visits", "total_orders", "achievements", "comparison"]}', '09:00:00'),
('My Weekly Expense Report', 'expense_report', 'Summary of expenses for the week', '{"sections": ["total_expenses", "category_breakdown", "pending_approvals"]}', '17:00:00'),
('My Performance Report', 'performance', 'Performance metrics for a selected period', '{"sections": ["sales", "visits", "productivity", "targets"]}', '09:00:00'),
('My Top Retailers', 'top_retailers', 'Your highest performing retailers', '{"sections": ["top_by_value", "top_by_frequency", "growth"]}', '10:00:00'),
('Focused Products Update', 'focused_products', 'Retailers who purchased focused products', '{"sections": ["retailers_list", "products_sold", "achievements"]}', '16:00:00'),
('High Value Orders', 'high_value_orders', 'Orders above a specified value threshold', '{"sections": ["order_list", "total_value", "retailers"]}', '15:00:00');