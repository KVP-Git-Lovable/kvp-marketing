-- Branding is not a sales rep's to change.
--
-- The earlier fix let any active portal user write their distributor's logo,
-- which is too broad: the logo and the terms print on every invoice that
-- distributor issues, so replacing them is an owner/manager decision.

create or replace function public.distributor_portal_can_manage_branding()
returns boolean
language sql stable security definer set search_path to 'public'
as $function$
  select exists (
    select 1 from distributor_users
    where auth_user_id = auth.uid()
      and is_active = true
      and role in ('owner', 'manager')
  );
$function$;

revoke all on function public.distributor_portal_can_manage_branding() from public, anon;
grant execute on function public.distributor_portal_can_manage_branding() to authenticated;

drop policy if exists "Portal users upload own branding" on storage.objects;
drop policy if exists "Portal users replace own branding" on storage.objects;
drop policy if exists "Portal users remove own branding" on storage.objects;

create policy "Portal owners upload own branding"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] in ('distributor-logos', 'distributor-qr-codes')
  and (storage.foldername(name))[2] = get_distributor_id_for_auth_user()::text
  and distributor_portal_can_manage_branding()
);

create policy "Portal owners replace own branding"
on storage.objects for update to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] in ('distributor-logos', 'distributor-qr-codes')
  and (storage.foldername(name))[2] = get_distributor_id_for_auth_user()::text
  and distributor_portal_can_manage_branding()
)
with check (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] in ('distributor-logos', 'distributor-qr-codes')
  and (storage.foldername(name))[2] = get_distributor_id_for_auth_user()::text
  and distributor_portal_can_manage_branding()
);

create policy "Portal owners remove own branding"
on storage.objects for delete to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] in ('distributor-logos', 'distributor-qr-codes')
  and (storage.foldername(name))[2] = get_distributor_id_for_auth_user()::text
  and distributor_portal_can_manage_branding()
);

-- Blocking the file alone is not enough: logo_url is a column on distributors,
-- and "Portal users update own distributor only" lets any portal user write
-- every column. RLS cannot gate a single column, so a trigger does it --
-- leaving the rest of the row under the existing policy.
create or replace function public.guard_distributor_branding_columns()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if get_distributor_id_for_auth_user() is null then
    return new;
  end if;

  if (new.logo_url is distinct from old.logo_url
      or new.qr_code_url is distinct from old.qr_code_url
      or new.qr_upi is distinct from old.qr_upi
      or new.terms_conditions is distinct from old.terms_conditions)
     and not distributor_portal_can_manage_branding() then
    raise exception
      'Only an owner or manager can change this distributor''s branding'
      using errcode = '42501';
  end if;

  return new;
end $function$;

drop trigger if exists guard_distributor_branding on public.distributors;
create trigger guard_distributor_branding
before update on public.distributors
for each row execute function public.guard_distributor_branding_columns();
