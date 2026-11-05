-- Backfill orphan pending leaves into approval engine
DO $$
DECLARE
  la RECORD;
BEGIN
  FOR la IN
    SELECT id, user_id FROM leave_applications
    WHERE status = 'pending'
      AND id::text NOT IN (SELECT entity_id::text FROM approval_requests WHERE entity_type = 'leave')
  LOOP
    BEGIN
      PERFORM create_approval_request('leave', la.id, la.user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create approval request for leave %: %', la.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Backfill orphan pending regularizations into approval engine
DO $$
DECLARE
  rr RECORD;
BEGIN
  FOR rr IN
    SELECT id, user_id FROM regularization_requests
    WHERE status = 'pending'
      AND id::text NOT IN (SELECT entity_id::text FROM approval_requests WHERE entity_type = 'regularization')
  LOOP
    BEGIN
      PERFORM create_approval_request('regularization', rr.id, rr.user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create approval request for regularization %: %', rr.id, SQLERRM;
    END;
  END LOOP;
END;
$$;