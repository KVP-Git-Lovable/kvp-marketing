-- Route to SEVERAL kinds of approver at once.
--
-- The process was one choice: admins, or the manager, or named people, or a
-- role. Real routing is often a union of those -- "the manager and the admins",
-- "these two people and anyone in Sales Manager" -- so the setting becomes a
-- multi-select and the approvers are everyone the selected modes resolve to.
--
-- approval_mode (singular) is left exactly as it is, because leave, expenses,
-- regularisation, credit notes, order backdates and order edits all read it.
-- approval_modes (plural) is additive: when it holds anything, it wins; when it
-- is null or empty, the old column decides and nothing about those six changes.
--
-- LEVELS. Manager routing is a ladder -- level 1 is your manager, level 2 is
-- theirs -- and that ladder is what "every level must approve, in order" acts
-- on. The other modes are not a ladder; they are alternatives. So:
--
--   manager alone           the ladder, unchanged, unanimous still meaningful
--   anything else, or a mix everyone on level 1, first response decides
--
-- Mixing a ladder with a flat set has no honest ordering -- there is no answer
-- to whether an admin outranks the rep's second-line manager -- so the mix
-- flattens rather than inventing a hierarchy nobody configured.

alter table public.approval_config
  add column if not exists approval_modes text[];

comment on column public.approval_config.approval_modes is
  'Several routes at once; approvers are the union. Null/empty falls back to approval_mode.';

alter table public.approval_config
  drop constraint if exists approval_config_approval_modes_check;

alter table public.approval_config
  add constraint approval_config_approval_modes_check
  check (
    approval_modes is null
    or approval_modes <@ array['manager','specific','admin','users','roles']::text[]
  );

-- Seed the plural column from the singular one so nothing reads as unset.
update public.approval_config
   set approval_modes = array[approval_mode]
 where approval_modes is null;


create or replace function public.create_approval_request(
  p_entity_type text,
  p_entity_id uuid,
  p_requester_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_chain RECORD; v_config RECORD; v_request_id uuid; v_levels integer := 0;
  v_ids uuid[] := '{}'; v_modes text[]; v_ladder boolean;
BEGIN
  SELECT * INTO v_config FROM approval_config WHERE entity_type = p_entity_type;

  v_modes := COALESCE(NULLIF(v_config.approval_modes, '{}'::text[]),
                      ARRAY[v_config.approval_mode]);

  -- The reporting ladder survives only when it is the whole answer.
  v_ladder := (v_modes = ARRAY['manager']::text[]);

  IF NOT v_ladder THEN
    IF 'admin' = ANY (v_modes) THEN
      v_ids := v_ids || COALESCE((
        SELECT array_agg(p.id) FROM profiles p
         WHERE p.is_active
           AND (public.has_role(p.id, 'admin'::app_role) OR public.is_system_admin(p.id))
      ), '{}'::uuid[]);
    END IF;

    IF 'users' = ANY (v_modes) THEN
      v_ids := v_ids || COALESCE((
        SELECT array_agg(p.id) FROM profiles p
         WHERE p.id = ANY (COALESCE(v_config.approver_user_ids, '{}'::uuid[]))
           AND p.is_active
      ), '{}'::uuid[]);
    END IF;

    IF 'roles' = ANY (v_modes) THEN
      v_ids := v_ids || COALESCE((
        SELECT array_agg(up.user_id)
          FROM user_profiles up JOIN profiles p ON p.id = up.user_id
         WHERE up.profile_id = ANY (COALESCE(v_config.approver_role_ids, '{}'::uuid[]))
           AND p.is_active
      ), '{}'::uuid[]);
    END IF;

    IF 'specific' = ANY (v_modes) AND v_config.specific_approver_id IS NOT NULL THEN
      v_ids := v_ids || ARRAY[v_config.specific_approver_id];
    END IF;

    -- Manager in a mix contributes the same people, flattened onto level 1.
    IF 'manager' = ANY (v_modes) THEN
      v_ids := v_ids || COALESCE((
        SELECT array_agg(c.manager_id)
          FROM (SELECT manager_id, level FROM get_reporting_chain(p_requester_id)
                 ORDER BY level LIMIT COALESCE(v_config.max_levels, 10)) c
      ), '{}'::uuid[]);
    END IF;

    -- Nobody approves their own, whichever route named them.
    SELECT array_agg(DISTINCT x) INTO v_ids
      FROM unnest(v_ids) x
     WHERE x IS NOT NULL AND x <> p_requester_id;

    IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
      RETURN NULL;
    END IF;

    INSERT INTO approval_requests
      (entity_type, entity_id, requester_id, current_level, total_levels, status)
    VALUES (p_entity_type, p_entity_id, p_requester_id, 1, 1, 'pending')
    RETURNING id INTO v_request_id;

    INSERT INTO approval_steps (approval_request_id, level, approver_id, status)
    SELECT v_request_id, 1, u, 'pending' FROM unnest(v_ids) u;

    INSERT INTO approval_audit_log
      (approval_request_id, entity_type, entity_id, action, performed_by, level, metadata)
    VALUES (v_request_id, p_entity_type, p_entity_id, 'submitted', p_requester_id, 0,
            jsonb_build_object('modes', v_modes, 'approvers', array_length(v_ids, 1)));
    RETURN v_request_id;
  END IF;

  -- ------------------------------------------------- unchanged: reporting chain
  FOR v_chain IN SELECT manager_id, level FROM get_reporting_chain(p_requester_id) ORDER BY level
                 LIMIT COALESCE(v_config.max_levels,10) LOOP v_levels := v_levels + 1; END LOOP;
  IF v_levels = 0 THEN v_levels := 1; END IF;

  INSERT INTO approval_requests (entity_type, entity_id, requester_id, current_level, total_levels, status)
  VALUES (p_entity_type, p_entity_id, p_requester_id, 1, v_levels, 'pending') RETURNING id INTO v_request_id;

  FOR v_chain IN SELECT manager_id, level FROM get_reporting_chain(p_requester_id) ORDER BY level
                 LIMIT COALESCE(v_config.max_levels,10) LOOP
    INSERT INTO approval_steps (approval_request_id, level, approver_id, status)
    VALUES (v_request_id, v_chain.level, v_chain.manager_id, 'pending');
  END LOOP;

  INSERT INTO approval_audit_log (approval_request_id, entity_type, entity_id, action, performed_by, level, metadata)
  VALUES (v_request_id, p_entity_type, p_entity_id, 'submitted', p_requester_id, 0, jsonb_build_object('total_levels', v_levels));
  RETURN v_request_id;
END; $function$;
