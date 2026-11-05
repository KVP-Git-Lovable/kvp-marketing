-- Copy retailers from Ajay Prabhu to Prajwal
INSERT INTO retailers (
  user_id, name, address, phone, category, priority, beat_id, beat_name,
  entity_type, competitors, potential, retail_type, location_tag,
  parent_name, parent_type, notes, longitude, latitude, order_value,
  last_visit_date, status
)
SELECT 
  'd63ecc6f-4ef4-468b-a237-7a6617bb7cdd'::UUID as user_id, 
  name, address, phone, category, priority, beat_id, beat_name,
  entity_type, competitors, potential, retail_type, location_tag,
  parent_name, parent_type, notes, longitude, latitude, order_value,
  last_visit_date, status
FROM retailers
WHERE user_id = '6d7227ff-c408-4b33-92c4-6227807e539b'::UUID;

-- Copy beat plans from Ajay Prabhu to Prajwal
INSERT INTO beat_plans (
  user_id, beat_id, beat_name, beat_data, plan_date
)
SELECT 
  'd63ecc6f-4ef4-468b-a237-7a6617bb7cdd'::UUID as user_id,
  beat_id, beat_name, beat_data, plan_date
FROM beat_plans
WHERE user_id = '6d7227ff-c408-4b33-92c4-6227807e539b'::UUID;