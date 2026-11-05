-- Fix corrupted visits: visits that have no_order_reason but status is not 'unproductive'
-- These were incorrectly overwritten by the Attendance check-in process
UPDATE visits 
SET status = 'unproductive',
    updated_at = now()
WHERE no_order_reason IS NOT NULL 
  AND status != 'unproductive';