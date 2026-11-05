-- Fix FY Sales Plan status from 'closed' back to 'active'
UPDATE fy_target_config 
SET plan_status = 'active', is_locked = true 
WHERE id = '728d55ce-9692-4b77-833b-7ac912c62a0b';