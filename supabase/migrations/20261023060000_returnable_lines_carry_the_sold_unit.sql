-- A return has to be measured in the unit the goods were sold in.
--
-- The return form took its unit from products.unit — the legacy text column —
-- falling back to the literal string 'Piece':
--
--     unit: product.unit || 'Piece'
--
-- For the twelve products whose legacy column still reads 'piece' while their
-- configured base is GRAM, that produced credit note lines in a unit the
-- product is not set up for. Nothing downstream could convert them: van stock
-- refused them, so returning goods never put them back on the van.
--
-- The obvious repair — read the configured unit instead — is wrong here. The
-- form carries `rate` from the original invoice line, and that rate is per unit
-- SOLD. Relabelling a return as GRAM while the rate is per KG would misprice
-- the credit note by a factor of a thousand. The unit that keeps rate times
-- quantity honest is the one on the original order line, and it is already
-- sitting in order_items.unit — just never returned.
--
-- The new column is appended rather than inserted, so anything reading the
-- result positionally keeps working.
--
-- A return type cannot be widened in place: CREATE OR REPLACE refuses to change
-- the shape of RETURNS TABLE, so the function is dropped first. Grants do not
-- survive a drop, so they are restated below exactly as they were:
-- PUBLIC, authenticated and service_role.

drop function if exists public.get_returnable_lines(uuid, uuid, uuid);

create or replace function public.get_returnable_lines(
  p_retailer_id uuid,
  p_product_id uuid,
  p_variant_id uuid
)
returns table(
  order_id uuid,
  invoice_number text,
  order_date date,
  sold_qty numeric,
  rate numeric,
  line_taxable numeric,
  cgst_amount numeric,
  sgst_amount numeric,
  returnable numeric,
  unit text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select o.id, o.invoice_number, o.order_date,
         oi.quantity, oi.rate, oi.total, oi.cgst_amount, oi.sgst_amount,
         public.returnable_qty(o.id, oi.product_id, oi.variant_id),
         oi.unit
  from orders o
  join order_items oi on oi.order_id = o.id
  where o.retailer_id = p_retailer_id
    and oi.product_id = p_product_id
    and (p_variant_id is null or oi.variant_id = p_variant_id)
    and coalesce(o.status,'') <> 'cancelled'
    and public.returnable_qty(o.id, oi.product_id, oi.variant_id) > 0
  order by o.order_date desc nulls last;
$function$;

grant execute on function public.get_returnable_lines(uuid, uuid, uuid) to public;
grant execute on function public.get_returnable_lines(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_returnable_lines(uuid, uuid, uuid) to service_role;
