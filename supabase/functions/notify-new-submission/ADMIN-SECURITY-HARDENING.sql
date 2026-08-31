-- APRILS SIGNATURE — ADMIN SECURITY HARDENING
-- Run this in Supabase SQL Editor after confirming the tables exist.
-- IMPORTANT: this script does NOT create or expose service-role keys.
-- It establishes a server-side authenticated-admin gate for admin data.
-- The first authenticated owner must be inserted into admin_security_users
-- manually using their Supabase Auth user UUID.

create table if not exists public.admin_security_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_security_users enable row level security;

create or replace function public.is_aprils_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.admin_security_users a
    where a.user_id = auth.uid() and a.active = true
  );
$$;

revoke all on function public.is_aprils_admin() from public;
grant execute on function public.is_aprils_admin() to authenticated;

-- Only an existing admin can see the security registry. Changes to it should
-- be made by the owner/manager through a trusted backend, not from the browser.
drop policy if exists admin_security_users_select on public.admin_security_users;
create policy admin_security_users_select on public.admin_security_users
for select to authenticated using (public.is_aprils_admin());

-- Generic hardening: admin users can manage data; the public site gets only
-- the minimum active/public rows it needs. Customer/private records remain closed.

alter table if exists public.settings enable row level security;
alter table if exists public.admin_services enable row level security;
alter table if exists public.training_programs enable row level security;
alter table if exists public.gallery_items enable row level security;
alter table if exists public.gallery_collections enable row level security;
alter table if exists public.testimonials enable row level security;
alter table if exists public.faqs enable row level security;
alter table if exists public.policies enable row level security;
alter table if exists public.quote_requests enable row level security;
alter table if exists public.training_registrations enable row level security;

-- settings contains both public configuration and private admin records.
-- Do not expose it wholesale. Existing public-site reads should be moved to
-- dedicated public views/settings before enabling a public SELECT policy.
drop policy if exists settings_admin_select on public.settings;
create policy settings_admin_select on public.settings
for select to authenticated using (public.is_aprils_admin());
drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings
for all to authenticated using (public.is_aprils_admin()) with check (public.is_aprils_admin());

-- Public website settings are limited to explicitly public keys only.
drop policy if exists settings_public_read on public.settings;
create policy settings_public_read on public.settings
for select to anon, authenticated using (
  setting_key like 'product_%'
  or setting_key like 'public_training_price_%'
  or setting_key like 'public_catalogue_%'
  or setting_key like 'homepage_featured_%'
  or setting_key like 'hidden_content_%'
  or setting_key like 'inventory_item_%'
  or setting_key in ('contact_extra','site_logo_data','site_logo_removed','site_link_payment')
);

-- Admin-managed catalog/content tables.
do $$
begin
  if to_regclass('public.admin_services') is not null then
    execute 'drop policy if exists admin_services_admin_all on public.admin_services';
    execute 'create policy admin_services_admin_all on public.admin_services for all to authenticated using (public.is_aprils_admin()) with check (public.is_aprils_admin())';
  end if;
  if to_regclass('public.training_programs') is not null then
    execute 'drop policy if exists training_programs_admin_all on public.training_programs';
    execute 'create policy training_programs_admin_all on public.training_programs for all to authenticated using (public.is_aprils_admin()) with check (public.is_aprils_admin())';
  end if;
  if to_regclass('public.gallery_items') is not null then
    execute 'drop policy if exists gallery_items_admin_all on public.gallery_items';
    execute 'create policy gallery_items_admin_all on public.gallery_items for all to authenticated using (public.is_aprils_admin()) with check (public.is_aprils_admin())';
  end if;
  if to_regclass('public.gallery_collections') is not null then
    execute 'drop policy if exists gallery_collections_admin_all on public.gallery_collections';
    execute 'create policy gallery_collections_admin_all on public.gallery_collections for all to authenticated using (public.is_aprils_admin()) with check (public.is_aprils_admin())';
  end if;
  if to_regclass('public.testimonials') is not null then
    execute 'drop policy if exists testimonials_admin_all on public.testimonials';
    execute 'create policy testimonials_admin_all on public.testimonials for all to authenticated using (public.is_aprils_admin()) with check (public.is_aprils_admin())';
  end if;
  if to_regclass('public.faqs') is not null then
    execute 'drop policy if exists faqs_admin_all on public.faqs';
    execute 'create policy faqs_admin_all on public.faqs for all to authenticated using (public.is_aprils_admin()) with check (public.is_aprils_admin())';
  end if;
  if to_regclass('public.policies') is not null then
    execute 'drop policy if exists policies_admin_all on public.policies';
    execute 'create policy policies_admin_all on public.policies for all to authenticated using (public.is_aprils_admin()) with check (public.is_aprils_admin())';
    execute 'drop policy if exists policies_public_read on public.policies';
    execute 'create policy policies_public_read on public.policies for select to anon, authenticated using (active = true)';
  end if;
  if to_regclass('public.admin_services') is not null then execute 'drop policy if exists admin_services_public_read on public.admin_services'; execute 'create policy admin_services_public_read on public.admin_services for select to anon, authenticated using (active = true)'; end if;
  if to_regclass('public.training_programs') is not null then execute 'drop policy if exists training_programs_public_read on public.training_programs'; execute 'create policy training_programs_public_read on public.training_programs for select to anon, authenticated using (active = true)'; end if;
  if to_regclass('public.gallery_items') is not null then execute 'drop policy if exists gallery_items_public_read on public.gallery_items'; execute 'create policy gallery_items_public_read on public.gallery_items for select to anon, authenticated using (active = true)'; end if;
  if to_regclass('public.gallery_collections') is not null then execute 'drop policy if exists gallery_collections_public_read on public.gallery_collections'; execute 'create policy gallery_collections_public_read on public.gallery_collections for select to anon, authenticated using (active = true)'; end if;
  if to_regclass('public.testimonials') is not null then execute 'drop policy if exists testimonials_public_read on public.testimonials'; execute 'create policy testimonials_public_read on public.testimonials for select to anon, authenticated using (active = true)'; end if;
  if to_regclass('public.faqs') is not null then execute 'drop policy if exists faqs_public_read on public.faqs'; execute 'create policy faqs_public_read on public.faqs for select to anon, authenticated using (active = true)'; end if;
end $$;

-- Customer submissions: never allow anonymous/public SELECT or UPDATE/DELETE.
-- Keep INSERT available to the public website so customers can submit forms.
do $$
begin
  if to_regclass('public.quote_requests') is not null then
    execute 'drop policy if exists quote_requests_admin_all on public.quote_requests';
    execute 'create policy quote_requests_admin_all on public.quote_requests for all to authenticated using (public.is_aprils_admin()) with check (public.is_aprils_admin())';
    execute 'drop policy if exists quote_requests_public_insert on public.quote_requests';
    execute 'create policy quote_requests_public_insert on public.quote_requests for insert to anon, authenticated with check (true)';
  end if;
  if to_regclass('public.training_registrations') is not null then
    execute 'drop policy if exists training_registrations_admin_all on public.training_registrations';
    execute 'create policy training_registrations_admin_all on public.training_registrations for all to authenticated using (public.is_aprils_admin()) with check (public.is_aprils_admin())';
    execute 'drop policy if exists training_registrations_public_insert on public.training_registrations';
    execute 'create policy training_registrations_public_insert on public.training_registrations for insert to anon, authenticated with check (true)';
  end if;
end $$;

-- Do NOT put the Supabase service-role key in the website. This SQL deliberately
-- requires an authenticated admin and is intended to be used with RLS.
