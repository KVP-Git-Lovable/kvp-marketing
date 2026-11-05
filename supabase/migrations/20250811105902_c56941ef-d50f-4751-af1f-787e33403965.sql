-- Create function to copy user data from one user to another
CREATE OR REPLACE FUNCTION copy_user_data_one_time(
  source_username TEXT,
  target_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  source_user_id UUID;
  retailers_copied INTEGER := 0;
  beats_copied INTEGER := 0;
BEGIN
  -- Find source user ID by username
  SELECT id INTO source_user_id
  FROM profiles
  WHERE username = source_username;
  
  IF source_user_id IS NULL THEN
    RETURN 'Source user "' || source_username || '" not found';
  END IF;
  
  -- Copy retailers
  INSERT INTO retailers (
    user_id, name, address, phone, category, priority, beat_id, beat_name,
    entity_type, competitors, potential, retail_type, location_tag,
    parent_name, parent_type, notes, longitude, latitude, order_value,
    last_visit_date, status
  )
  SELECT 
    target_user_id, name, address, phone, category, priority, beat_id, beat_name,
    entity_type, competitors, potential, retail_type, location_tag,
    parent_name, parent_type, notes, longitude, latitude, order_value,
    last_visit_date, status
  FROM retailers
  WHERE user_id = source_user_id;
  
  GET DIAGNOSTICS retailers_copied = ROW_COUNT;
  
  -- Copy beat plans
  INSERT INTO beat_plans (
    user_id, beat_id, beat_name, beat_data, plan_date
  )
  SELECT 
    target_user_id, beat_id, beat_name, beat_data, plan_date
  FROM beat_plans
  WHERE user_id = source_user_id;
  
  GET DIAGNOSTICS beats_copied = ROW_COUNT;
  
  RETURN 'Successfully copied ' || retailers_copied || ' retailers and ' || beats_copied || ' beat plans from ' || source_username || ' to target user';
END;
$$;

-- Execute the copy operation from Ajay to Prajwal
SELECT copy_user_data_one_time('Ajay', 'd63ecc6f-4ef4-468b-a237-7a6617bb7cdd'::UUID);

-- Drop the function after use since it's a one-time operation
DROP FUNCTION copy_user_data_one_time(TEXT, UUID);