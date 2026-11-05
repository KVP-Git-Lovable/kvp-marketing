-- Net weight, captured on the order line at the moment the order is written.
--
-- products.net_weight_g already exists, so this adds no new product attribute
-- and touches no UoM conversion: not uom_master, not conversion_to_base, not
-- base_unit, not conversion_factor. Net weight is read as its own thing.
--
-- Snapshotted rather than joined at read time because a milestone that has
-- already been judged must not silently re-judge itself when somebody edits a
-- product's weight months later. The trigger fills it from the variant first,
-- then the product, so every order-writing path gets it -- cart, van sales,
-- counter sale -- without any of them having to know about it.
alter table public.order_items
  add column if not exists net_weight_g numeric;

comment on column public.order_items.net_weight_g is
  'Net weight in grams of ONE selling unit, snapshotted from the variant or product when the line was written. Line weight = quantity * net_weight_g. Null means the product has no net weight configured, so the line cannot be weighed.';

create or replace function public.order_items_capture_net_weight()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  IF NEW.net_weight_g IS NULL THEN
    SELECT NULLIF(pv.net_weight_g, 0) INTO NEW.net_weight_g
    FROM public.product_variants pv WHERE pv.id = NEW.variant_id;
  END IF;

  IF NEW.net_weight_g IS NULL THEN
    SELECT NULLIF(p.net_weight_g, 0) INTO NEW.net_weight_g
    FROM public.products p WHERE p.id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$function$;

drop trigger if exists trg_order_items_capture_net_weight on public.order_items;
create trigger trg_order_items_capture_net_weight
  before insert on public.order_items
  for each row execute function public.order_items_capture_net_weight();

-- Backfill what the master can answer for today. Lines whose product has no
-- net weight stay null and are reported as unweighable rather than counted
-- as zero.
update public.order_items oi
set net_weight_g = w.g
from (
  select oi2.id,
         coalesce(nullif(pv.net_weight_g, 0), nullif(p.net_weight_g, 0)) as g
  from public.order_items oi2
  left join public.products p on p.id = oi2.product_id
  left join public.product_variants pv on pv.id = oi2.variant_id
) w
where w.id = oi.id and oi.net_weight_g is null and w.g is not null;
