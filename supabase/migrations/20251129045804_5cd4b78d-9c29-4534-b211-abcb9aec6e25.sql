-- Create performance comments table
CREATE TABLE IF NOT EXISTS performance_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  period_type TEXT NOT NULL, -- 'day' | 'month' | 'quarter' | 'year'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  self_comment TEXT,
  self_rating NUMERIC CHECK (self_rating >= 0 AND self_rating <= 10),
  manager_comment TEXT,
  manager_rating NUMERIC CHECK (manager_rating >= 0 AND manager_rating <= 10),
  manager_id UUID,
  hr_comment TEXT,
  hr_rating NUMERIC CHECK (hr_rating >= 0 AND hr_rating <= 10),
  hr_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period_type, period_start)
);

-- Enable RLS
ALTER TABLE performance_comments ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own comments
CREATE POLICY "Users can view their own performance comments"
ON performance_comments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own self comments"
ON performance_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own self comments"
ON performance_comments FOR UPDATE
USING (auth.uid() = user_id);

-- Managers can view and update comments for their subordinates
CREATE POLICY "Managers can view subordinate performance comments"
ON performance_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.user_id = performance_comments.user_id
    AND e.manager_id = auth.uid()
  )
);

CREATE POLICY "Managers can update subordinate manager comments"
ON performance_comments FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.user_id = performance_comments.user_id
    AND e.manager_id = auth.uid()
  )
);

-- Admins can manage all comments
CREATE POLICY "Admins can manage all performance comments"
ON performance_comments FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create function to get subordinate users via manager hierarchy
CREATE OR REPLACE FUNCTION get_subordinate_users(user_id_param UUID)
RETURNS TABLE (subordinate_user_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT e.user_id
  FROM employees e
  WHERE e.manager_id = user_id_param;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;