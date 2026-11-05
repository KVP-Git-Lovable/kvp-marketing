-- Configurable approval routing: manager, admin, named people, or a role.
--
-- The engine could route two ways: up the reporting chain, or to ONE named
-- person (specific_approver_id, singular). Redemptions need more than that --
-- "send these to the admins", "send these to Abhishek and Rahul", "send these
-- to whoever holds the Sales Manager role" -- and the point of putting it in
-- configuration is that changing the answer later must not mean changing code.
--
-- Three new modes, all resolving to a single level with several pending steps,
-- so ANY one of the people named can approve and the first response settles it.
-- That is how the manager route already behaves when a chain has several
-- levels and require_all_levels is off.
--
-- "Role" here means security_profiles -- what the app calls Security Roles and
-- shows in SecurityRolesDisplay: Sales Manager, Field Sales Executive, Product
-- Manager, System Administrator, Data Viewer. The role_definitions table sounds
-- like the right home for this and is empty; user_profiles.profile_id is what
-- actually links a person to one of these.
--
-- create_approval_request is SHARED with leave, expenses, regularisation,
-- credit notes, order backdates and order edits. The new modes are added as a
-- branch ahead of the existing ones, and the manager and specific paths below
-- are untouched, so every entity type that uses them routes exactly as before.

alter table public.approval_config
  add column if not exists approver_user_ids uuid[],
  add column if not exists approver_role_ids uuid[];

comment on column public.approval_config.approver_user_ids is
  'approval_mode = users: the people who may approve. Any one of them settles it.';
comment on column public.approval_config.approver_role_ids is
  'approval_mode = roles: security_profiles ids. Every active holder may approve.';

-- Free text until now, so a typo in the mode silently fell through to the
-- manager branch and routed somewhere nobody chose.
alter table public.approval_config
  drop constraint if exists approval_config_approval_mode_check;

alter table public.approval_config
  add constraint approval_config_approval_mode_check
  check (approval_mode in ('manager', 'specific', 'admin', 'users', 'roles'));

-- Redemptions default to admin, as specified. Only this entity type is
-- touched; nothing else changes route.
update public.approval_config
   set approval_mode = 'admin', updated_at = now()
 where entity_type = 'gamification_redemption'
   and approval_mode = 'manager';


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
  v_ids uuid[];
BEGIN
  SELECT * INTO v_config FROM approval_config WHERE entity_type = p_entity_type;

  -- ---------------------------------------------------------------- new modes
  IF v_config.approval_mode IN ('admin', 'users', 'roles') THEN

    IF v_config.approval_mode = 'admin' THEN
      SELECT array_agg(DISTINCT p.id) INTO v_ids
        FROM profiles p
       WHERE p.is_active
         AND p.id <> p_requester_id
         AND (public.has_role(p.id, 'admin'::app_role) OR public.is_system_admin(p.id));

    ELSIF v_config.approval_mode = 'users' THEN
      SELECT array_agg(DISTINCT p.id) INTO v_ids
        FROM profiles p
       WHERE p.id = ANY (COALESCE(v_config.approver_user_ids, '{}'::uuid[]))
         AND p.is_active
         AND p.id <> p_requester_id;

    ELSE  -- roles
      SELECT array_agg(DISTINCT up.user_id) INTO v_ids
        FROM user_profiles up
        JOIN profiles p ON p.id = up.user_id
       WHERE up.profile_id = ANY (COALESCE(v_config.approver_role_ids, '{}'::uuid[]))
         AND p.is_active
         AND up.user_id <> p_requester_id;
    END IF;

    -- Nobody to send it to. Returning NULL rather than inventing a fallback:
    -- gam_redeem_request treats that as a hard failure and refuses the request,
    -- which is the safe end of "policy says approve but no approver exists".
    -- The requester is always excluded above, so configuring a single approver
    -- and then having that person request is one way to land here.
    IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
      RETURN NULL;
    END IF;

    INSERT INTO approval_requests
      (entity_type, entity_id, requester_id, current_level, total_levels, status)
    VALUES (p_entity_type, p_entity_id, p_requester_id, 1, 1, 'pending')
    RETURNING id INTO v_request_id;

    -- All at level 1: these are alternatives, not a ladder.
    INSERT INTO approval_steps (approval_request_id, level, approver_id, status)
    SELECT v_request_id, 1, u, 'pending' FROM unnest(v_ids) u;

    INSERT INTO approval_audit_log
      (approval_request_id, entity_type, entity_id, action, performed_by, level, metadata)
    VALUES (v_request_id, p_entity_type, p_entity_id, 'submitted', p_requester_id, 0,
            jsonb_build_object('mode', v_config.approval_mode,
                               'approvers', array_length(v_ids, 1)));
    RETURN v_request_id;
  END IF;

  -- ------------------------------------------------- unchanged: one named person
  IF v_config.approval_mode = 'specific' THEN
    IF v_config.specific_approver_id IS NULL THEN
      RETURN NULL;
    END IF;
    INSERT INTO approval_requests (entity_type, entity_id, requester_id, current_level, total_levels, status)
    VALUES (p_entity_type, p_entity_id, p_requester_id, 1, 1, 'pending') RETURNING id INTO v_request_id;
    INSERT INTO approval_steps (approval_request_id, level, approver_id, status)
    VALUES (v_request_id, 1, v_config.specific_approver_id, 'pending');
    INSERT INTO approval_audit_log (approval_request_id, entity_type, entity_id, action, performed_by, level, metadata)
    VALUES (v_request_id, p_entity_type, p_entity_id, 'submitted', p_requester_id, 0, jsonb_build_object('mode','specific'));
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


-- The roles an admin can route to, for the picker. Names only.
create or replace function public.gam_approver_roles()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select sp.id, sp.name::text
  from public.security_profiles sp
  where auth.uid() is not null
  order by sp.name;
$function$;

revoke all on function public.gam_approver_roles() from public;
grant execute on function public.gam_approver_roles() to authenticated;


-- Say WHO it went to, so a row you cannot action explains itself.
--
-- A manager still sees their reports' requests even when the configured route
-- sent them elsewhere -- oversight is worth keeping -- but the buttons are
-- disabled, and "Waiting on an earlier approver" is simply untrue in that case:
-- nobody earlier is involved, the request was never routed to them at all.
-- routed_to lets the screen say which it is.
drop function if exists public.gam_redemption_queue(text[]);

create function public.gam_redemption_queue(p_statuses text[] default null)
returns table (
  id uuid,
  user_id uuid,
  person text,
  points_redeemed numeric,
  voucher_amount numeric,
  status text,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  payment_mode text,
  payment_reference text,
  payment_note text,
  rejection_reason text,
  balance numeric,
  available numeric,
  approval_request_id uuid,
  my_turn boolean,
  routed_to text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.user_id,
         coalesce(p.full_name, p.username, 'Unknown user')::text,
         r.points_redeemed, r.voucher_amount, r.status,
         r.requested_at, r.approved_at,
         coalesce(ap.full_name, ap.username)::text,
         r.paid_at,
         coalesce(pp.full_name, pp.username)::text,
         r.payment_mode, r.payment_reference, r.payment_note, r.rejection_reason,
         public.gam_user_balance(r.user_id),
         public.gam_available_to_redeem(r.user_id),
         r.approval_request_id,
         (coalesce(public.is_admin_or_manager(), false)
          or r.approval_request_id is null
          or exists (select 1 from public.approval_steps s
                      where s.approval_request_id = r.approval_request_id
                        and s.approver_id = auth.uid() and s.status = 'pending')),
         (select string_agg(coalesce(m.full_name, m.username), ', ' order by s.level, m.full_name)
            from public.approval_steps s
            join public.profiles m on m.id = s.approver_id
           where s.approval_request_id = r.approval_request_id
             and s.status = 'pending')::text
  from public.gamification_redemptions r
  join public.profiles p on p.id = r.user_id
  left join public.profiles ap on ap.id = r.approved_by
  left join public.profiles pp on pp.id = coalesce(r.paid_by, r.processed_by)
  where public.gam_can_settle_redemption(r.id)
    and (p_statuses is null or r.status = any(p_statuses))
  order by
    case r.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    r.requested_at asc;
$function$;

revoke all on function public.gam_redemption_queue(text[]) from public;
grant execute on function public.gam_redemption_queue(text[]) to authenticated;
