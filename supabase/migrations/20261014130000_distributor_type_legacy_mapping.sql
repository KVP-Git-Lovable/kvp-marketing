-- distributor_types.legacy_mapping already held the distribution_level value for
-- DD, SS and USS. The mirror trigger added in the previous migration repeated the
-- same mapping as a hardcoded CASE, so the two could drift and only one of them
-- was configurable. Fill in the two missing values and read the mapping from the
-- table instead.

update public.distributor_types set legacy_mapping = 'company' where code = 'OEM' and legacy_mapping is null;
update public.distributor_types set legacy_mapping = 'agent'   where code = 'AG'  and legacy_mapping is null;

-- OEM and AG both sat at sort_order 0, so the order of the two was whatever the
-- planner felt like. The root must come first.
update public.distributor_types set sort_order = 0 where code = 'OEM';
update public.distributor_types set sort_order = 9 where code = 'AG';

create or replace function public.distributors_mirror_level_from_type()
returns trigger
language plpgsql
set search_path = public
as $function$
DECLARE v_mapping text;
BEGIN
  IF NEW.type_id IS NULL THEN RETURN NEW; END IF;

  SELECT t.legacy_mapping INTO v_mapping
  FROM public.distributor_types t WHERE t.id = NEW.type_id;

  -- A type with no mapping configured leaves the legacy column alone rather
  -- than blanking it, so adding a type cannot wipe a column the UI still reads.
  IF v_mapping IS NOT NULL THEN
    NEW.distribution_level := v_mapping;
  END IF;

  RETURN NEW;
END;
$function$;

-- Bring the mirrored column into line with the types already set.
--
-- Three rows disagreed with their own type_id, because type_id was set before
-- anything kept the two in step: the OEM read as a legacy "Distributor", and two
-- Direct Distributors read as "Sub-Distributor" and "Agent". Every value here is
-- derived from the type someone deliberately chose, so this corrects the copy,
-- not the decision.
update public.distributors d
set distribution_level = t.legacy_mapping
from public.distributor_types t
where t.id = d.type_id
  and t.legacy_mapping is not null
  and d.distribution_level is distinct from t.legacy_mapping;
