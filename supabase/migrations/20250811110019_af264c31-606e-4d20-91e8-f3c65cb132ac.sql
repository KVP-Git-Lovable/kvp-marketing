-- Copy retailers from Ajay Prabhu to Prajwal (only new ones)
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
FROM retailers r1
WHERE r1.user_id = '6d7227ff-c408-4b33-92c4-6227807e539b'::UUID
AND NOT EXISTS (
  SELECT 1 FROM retailers r2 
  WHERE r2.user_id = 'd63ecc6f-4ef4-468b-a237-7a6617bb7cdd'::UUID 
  AND r2.name = r1.name 
  AND r2.address = r1.address
);

-- Copy beat plans from Ajay Prabhu to Prajwal (only new ones)
INSERT INTO beat_plans (
  user_id, beat_id, beat_name, beat_data, plan_date
)
SELECT 
  'd63ecc6f-4ef4-468b-a237-7a6617bb7cdd'::UUID as user_id,
  beat_id, beat_name, beat_data, plan_date
FROM beat_plans bp1
WHERE bp1.user_id = '6d7227ff-c408-4b33-92c4-6227807e539b'::UUID
AND NOT EXISTS (
  SELECT 1 FROM beat_plans bp2 
  WHERE bp2.user_id = 'd63ecc6f-4ef4-468b-a237-7a6617bb7cdd'::UUID 
  AND bp2.beat_id = bp1.beat_id 
  AND bp2.plan_date = bp1.plan_date
);