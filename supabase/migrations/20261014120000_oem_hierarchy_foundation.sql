-- OEM / Company as the root of the distributor hierarchy.
--
-- The types already existed in distributor_types (OEM, DD, SS, USS, AG) with
-- parent_allowed and parent_type_code describing who may sit under whom, but
-- nothing enforced them and nothing could walk the tree further than one level.
-- This migration supplies the structure only: no distributor rows are created
-- or altered, and the five untyped legacy rows are left exactly as they are.
--
-- Deliberately NOT in here: can_view_distributor still looks one level deep.
-- Pointing it at get_distributor_descendants widens what every parent can see,
-- so it travels on its own migration with a before/after visibility matrix.

-- 1. Walk the tree.
--
-- Returns every distributor below p_root with its depth (direct children are 1).
-- SECURITY DEFINER because the RLS policies that will eventually call this must
-- be able to see the whole tree to decide who may see what; it returns ids and
-- depths only, never any distributor's data.
create or replace function public.get_distributor_descendants(p_root uuid)
returns table (distributor_id uuid, depth integer)
language sql
stable
security definer
set search_path = public
as $function$
  with recursive tree as (
    select d.id, 1 as depth, array[d.id] as path
    from public.distributors d
    where d.parent_id = p_root

    union all

    select c.id, t.depth + 1, t.path || c.id
    from public.distributors c
    join tree t on c.parent_id = t.id
    where not c.id = any(t.path)   -- a node already seen is not followed again
      and t.depth < 20             -- belt and braces against a malformed tree
  )
  select id, depth from tree;
$function$;

-- 2. Refuse cycles.
--
-- A cycle would make the recursive walk above depend on its own guards rather
-- than on the data being sound, and would strand a whole subtree outside every
-- parent's view. Cheaper to make it unrepresentable.
create or replace function public.distributors_reject_cycle()
returns trigger
language plpgsql
set search_path = public
as $function$
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A distributor cannot be its own parent';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.get_distributor_descendants(NEW.id) d
    WHERE d.distributor_id = NEW.parent_id
  ) THEN
    RAISE EXCEPTION 'Cannot set parent: % is already below % in the hierarchy',
      NEW.parent_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Keep the legacy column honest.
--
-- Most of the UI still reads distributors.distribution_level rather than
-- type_id. Rather than rewrite every one of those readers at once, the type is
-- the source of truth and the old text column is mirrored from it, so old and
-- new code agree for as long as both exist.
create or replace function public.distributors_mirror_level_from_type()
returns trigger
language plpgsql
set search_path = public
as $function$
DECLARE v_code text;
BEGIN
  IF NEW.type_id IS NULL THEN RETURN NEW; END IF;

  SELECT t.code INTO v_code FROM public.distributor_types t WHERE t.id = NEW.type_id;

  NEW.distribution_level := CASE v_code
    WHEN 'OEM' THEN 'company'
    WHEN 'DD'  THEN 'direct_distributor'
    WHEN 'SS'  THEN 'super_stockist'
    WHEN 'USS' THEN 'under_super_stockist'
    WHEN 'AG'  THEN 'agent'
    ELSE NEW.distribution_level
  END;

  RETURN NEW;
END;
$function$;

-- 4. Enforce the shape the types already describe.
--
-- parent_allowed = false means a root: the OEM may not be given a parent.
-- parent_type_code names the only type a parent may be, so a USS must sit under
-- an SS and cannot be hung straight off the OEM.
create or replace function public.distributors_validate_parent_type()
returns trigger
language plpgsql
set search_path = public
as $function$
DECLARE
  v_type record;
  v_parent_code text;
BEGIN
  IF NEW.type_id IS NULL THEN RETURN NEW; END IF;

  SELECT t.code, t.parent_allowed, t.parent_type_code INTO v_type
  FROM public.distributor_types t WHERE t.id = NEW.type_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NOT v_type.parent_allowed AND NEW.parent_id IS NOT NULL THEN
    RAISE EXCEPTION '% sits at the top of the hierarchy and cannot have a parent', v_type.code;
  END IF;

  IF v_type.parent_allowed AND NEW.parent_id IS NOT NULL AND v_type.parent_type_code IS NOT NULL THEN
    SELECT pt.code INTO v_parent_code
    FROM public.distributors p
    JOIN public.distributor_types pt ON pt.id = p.type_id
    WHERE p.id = NEW.parent_id;

    -- An untyped parent is permitted while the data is still being migrated;
    -- a typed one must be the right type.
    IF v_parent_code IS NOT NULL AND v_parent_code IS DISTINCT FROM v_type.parent_type_code THEN
      RAISE EXCEPTION 'A % must sit under a %, not under a %',
        v_type.code, v_type.parent_type_code, v_parent_code;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. Find the OEM.
--
-- By type code, never by a hardcoded id, so the record the user creates is
-- found without a follow-up migration. Returns the oldest when more than one
-- exists: today there is exactly one, and a second OEM would be a deliberate
-- decision that brings its own scoping rules with it.
create or replace function public.get_oem_distributor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $function$
  select d.id
  from public.distributors d
  join public.distributor_types t on t.id = d.type_id
  where t.code = 'OEM'
  order by d.created_at
  limit 1;
$function$;

-- Triggers fire only when the columns they police are touched, so unrelated
-- updates to a distributor cost nothing.
drop trigger if exists trg_distributors_reject_cycle on public.distributors;
create trigger trg_distributors_reject_cycle
  before insert or update of parent_id on public.distributors
  for each row execute function public.distributors_reject_cycle();

drop trigger if exists trg_distributors_mirror_level on public.distributors;
create trigger trg_distributors_mirror_level
  before insert or update of type_id on public.distributors
  for each row execute function public.distributors_mirror_level_from_type();

drop trigger if exists trg_distributors_validate_parent_type on public.distributors;
create trigger trg_distributors_validate_parent_type
  before insert or update of parent_id, type_id on public.distributors
  for each row execute function public.distributors_validate_parent_type();

revoke all on function public.get_distributor_descendants(uuid) from public;
grant execute on function public.get_distributor_descendants(uuid) to authenticated;
revoke all on function public.get_oem_distributor_id() from public;
grant execute on function public.get_oem_distributor_id() to authenticated;
