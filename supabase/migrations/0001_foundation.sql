-- ============================================================================
-- 0001 — Foundation: enums, helpers, identity and the role model.
--
-- Everything downstream depends on the two helper functions defined here, so
-- read this file before the others.
--
-- Two rules shape the whole schema:
--
--   1. Row-level security is the enforcement point, not the application. Every
--      table gets RLS enabled, and a table with RLS on and no matching policy
--      denies by default. Knowing the admin URL grants nothing.
--
--   2. `service_role` bypasses RLS entirely. That key stays on the server and
--      is what writes orders and payments after the server has priced them.
--      Nothing in this schema lets a browser set a price.
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- product search

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type public.admin_role as enum (
  'super_admin',
  'catalog_manager',
  'order_manager',
  'content_manager',
  'support'
);

create type public.order_status as enum (
  'pending_payment',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
  'refunded'
);

create type public.payment_status as enum (
  'pending',
  'authorized',
  'paid',
  'failed',
  'refunded',
  'partially_refunded'
);

create type public.product_badge as enum (
  'new',
  'bestseller',
  'limited',
  'back_in_stock'
);

create type public.media_bucket as enum (
  'products',
  'collections',
  'banners',
  'homepage',
  'media'
);

create type public.homepage_section_key as enum (
  'hero',
  'mood_tiles',
  'occasions',
  'featured_products',
  'story',
  'journal'
);

-- ----------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest
-- ----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Identity
-- ----------------------------------------------------------------------------

-- Mirrors auth.users with the profile fields the storefront needs. Created by
-- a trigger on sign-up so a profile row always exists for a signed-in user.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  phone        text,
  -- Marketing consent is explicit and defaults to false. WhatsApp order
  -- notifications are transactional and do not depend on this.
  accepts_marketing boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A user may hold several roles; super_admin implies all of them.
create table public.admin_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.admin_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index admin_roles_user_idx on public.admin_roles (user_id);

-- ----------------------------------------------------------------------------
-- Role helpers
--
-- Both are SECURITY DEFINER so they read admin_roles without RLS applying. If
-- they did not, a policy on admin_roles that calls them would recurse forever.
--
-- `set search_path = ''` means every name inside must be schema-qualified. That
-- is deliberate: it stops a caller shadowing `admin_roles` with a temp table
-- and escalating themselves.
--
-- auth.uid() is wrapped in a sub-select so Postgres evaluates it once per query
-- as an initplan rather than once per row.
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_roles ar
    where ar.user_id = (select auth.uid())
  );
$$;

comment on function public.is_admin() is
  'True when the caller holds any admin role. Use has_admin_role for anything narrower.';

create or replace function public.has_admin_role(required public.admin_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_roles ar
    where ar.user_id = (select auth.uid())
      and (ar.role = 'super_admin' or ar.role = any (required))
  );
$$;

comment on function public.has_admin_role(public.admin_role[]) is
  'True when the caller holds one of the given roles. super_admin always passes.';

revoke execute on function public.is_admin() from public;
revoke execute on function public.has_admin_role(public.admin_role[]) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_admin_role(public.admin_role[]) to authenticated;

-- ----------------------------------------------------------------------------
-- RLS: profiles
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Support can read a profile to answer an order question. Deliberately read
-- only, and deliberately not granted to catalog or content managers.
create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (public.has_admin_role(array['order_manager', 'support']::public.admin_role[]));

-- No delete policy: account deletion cascades from auth.users, which only the
-- service role may touch.

-- ----------------------------------------------------------------------------
-- RLS: admin_roles
--
-- The most sensitive table here — write access is the ability to grant
-- yourself anything, so only super_admin may change it.
-- ----------------------------------------------------------------------------

alter table public.admin_roles enable row level security;

create policy admin_roles_select_own on public.admin_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy admin_roles_select_super on public.admin_roles
  for select to authenticated
  using (public.has_admin_role(array['super_admin']::public.admin_role[]));

create policy admin_roles_write_super on public.admin_roles
  for all to authenticated
  using (public.has_admin_role(array['super_admin']::public.admin_role[]))
  with check (public.has_admin_role(array['super_admin']::public.admin_role[]));
