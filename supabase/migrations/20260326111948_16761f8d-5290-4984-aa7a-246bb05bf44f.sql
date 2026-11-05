-- 1. Recreate get_reporting_chain() function
CREATE OR REPLACE FUNCTION public.get_reporting_chain(p_user_id uuid)
RETURNS TABLE(manager_id uuid, level int)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE chain AS (
    SELECT e.manager_id, 1 AS level
    FROM employees e
    WHERE e.user_id = p_user_id AND e.manager_id IS NOT NULL
    UNION ALL
    SELECT e.manager_id, c.level + 1
    FROM chain c JOIN employees e ON e.user_id = c.manager_id
    WHERE e.manager_id IS NOT NULL AND c.level < 10
  )
  SELECT chain.manager_id, chain.level FROM chain ORDER BY chain.level;
$$;
GRANT EXECUTE ON FUNCTION public.get_reporting_chain(uuid) TO authenticated;

-- 2. Attach trigger on additional_expenses for creating approval requests
DROP TRIGGER IF EXISTS tr_expense_approval_request ON public.additional_expenses;
CREATE TRIGGER tr_expense_approval_request
  BEFORE INSERT OR UPDATE ON public.additional_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_expense_approval_request();

-- 3. Attach trigger on approval_requests for syncing status back
DROP TRIGGER IF EXISTS trg_sync_entity_status ON public.approval_requests;
CREATE TRIGGER trg_sync_entity_status
  AFTER UPDATE ON public.approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_entity_status();