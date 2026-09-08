-- ============================================================================
-- 0005 — Customer-owned data: addresses, carts, wishlists, coupons.
--
-- The RLS shape here is the one the brief cares most about: a customer can
-- read and write their own rows and nobody else's. Every policy below is
-- `owner_id = auth.uid()` on both USING and WITH CHECK — the second half
-- matters, because without it a customer could update their own row to point
-- at someone else's id.
--
-- Coupons are the exception: no read policy at all. The discount is resolved
-- by a SECURITY DEFINER function so codes cannot be enumerated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Addresses
-- ----------------------------------------------------------------------------

create table public.addresses (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references auth.users (id) on delete cascade,
  full_name     text not null,
  phone         text not null,
  line1         text not null,
  line2         text,
  landmark      text,
  city          text not null,
  state         text not null,
  -- Indian pincodes are six digits and never begin with zero.
  pincode       text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  country       text not null default 'IN' check (country = 'IN'),
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger addresses_touch
  before update on public.addresses
  for each row execute function public.touch_updated_at();

create index addresses_customer_idx on public.addresses (customer_id);

-- At most one default per customer, enforced by the database rather than by
-- remembering to clear the old one in application code.
create unique index addresses_one_default_idx
  on public.addresses (customer_id)
  where is_default;

-- ----------------------------------------------------------------------------
-- Carts
--
-- A cart belongs to a signed-in customer or to an anonymous session token, so
-- a guest can shop before signing in. On sign-in the guest cart is merged into
-- the customer's and deleted.
-- ----------------------------------------------------------------------------

create table public.carts (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references auth.users (id) on delete cascade,
  -- Opaque token held in a cookie by guests.
  session_token text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint carts_owner_present
    check (customer_id is not null or session_token is not null)
);

create trigger carts_touch
  before update on public.carts
  for each row execute function public.touch_updated_at();

create unique index carts_customer_idx
  on public.carts (customer_id) where customer_id is not null;
create unique index carts_session_idx
  on public.carts (session_token) where session_token is not null;

create table public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity   integer not null default 1 check (quantity > 0 and quantity <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create trigger cart_items_touch
  before update on public.cart_items
  for each row execute function public.touch_updated_at();

create index cart_items_cart_idx on public.cart_items (cart_id);

-- Note what is absent: no price column. A cart records intent — which variant,
-- how many — and nothing else. The price is read from the product at checkout,
-- so a stale or tampered cart cannot carry a stale or tampered price.

-- ----------------------------------------------------------------------------
-- Wishlists
-- ----------------------------------------------------------------------------

create table public.wishlists (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade unique,
  created_at  timestamptz not null default now()
);

create table public.wishlist_items (
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);

create index wishlist_items_product_idx on public.wishlist_items (product_id);

-- ----------------------------------------------------------------------------
-- Coupons
-- ----------------------------------------------------------------------------

create table public.coupons (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  description         text not null default '',
  -- Exactly one of the two discount forms, never both and never neither.
  percent_off         integer check (percent_off between 1 and 100),
  amount_off_paise    bigint check (amount_off_paise > 0),
  min_subtotal_paise  bigint not null default 0 check (min_subtotal_paise >= 0),
  -- Null means unlimited.
  max_redemptions     integer check (max_redemptions > 0),
  redemption_count    integer not null default 0 check (redemption_count >= 0),
  starts_at           timestamptz,
  ends_at             timestamptz,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint coupons_one_discount_form check (
    (percent_off is not null and amount_off_paise is null)
    or (percent_off is null and amount_off_paise is not null)
  ),
  constraint coupons_window check (ends_at is null or starts_at is null
                                   or ends_at > starts_at)
);

create trigger coupons_touch
  before update on public.coupons
  for each row execute function public.touch_updated_at();

-- Codes are compared case-insensitively, so FIRSTDRAPE and firstdrape are the
-- same coupon and cannot both be created.
create unique index coupons_code_lower_idx on public.coupons (lower(code));

-- ----------------------------------------------------------------------------
-- Coupon validation
--
-- The only way a client learns anything about a coupon. Returns the discount
-- for a given subtotal, or a reason it does not apply. Because it is SECURITY
-- DEFINER over a table with no read policy, a customer can test a code they
-- were given but cannot list the codes they were not.
--
-- Checkout must call this again against server-priced lines before creating
-- the Razorpay order. What the bag page displayed is not evidence.
-- ----------------------------------------------------------------------------

create or replace function public.validate_coupon(
  p_code     text,
  p_subtotal bigint
)
returns table (ok boolean, reason text, discount_paise bigint, description text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.coupons%rowtype;
begin
  if p_code is null or btrim(p_code) = '' then
    return query select false, 'Enter a code to apply.', 0::bigint, null::text;
    return;
  end if;

  select * into c
  from public.coupons
  where lower(code) = lower(btrim(p_code));

  if not found or not c.is_active then
    return query select false, 'That code is not valid.', 0::bigint, null::text;
    return;
  end if;

  if c.starts_at is not null and c.starts_at > now() then
    return query select false, 'That code is not active yet.', 0::bigint, null::text;
    return;
  end if;

  if c.ends_at is not null and c.ends_at <= now() then
    return query select false, 'That code has expired.', 0::bigint, null::text;
    return;
  end if;

  if c.max_redemptions is not null and c.redemption_count >= c.max_redemptions then
    return query select false, 'That code has been fully redeemed.', 0::bigint, null::text;
    return;
  end if;

  if p_subtotal < c.min_subtotal_paise then
    return query select
      false,
      'Spend ₹' || to_char(c.min_subtotal_paise / 100.0, 'FM999,999,990') ||
        ' to use this code.',
      0::bigint,
      null::text;
    return;
  end if;

  -- Percentages round down, so a rounding error can never favour the customer
  -- over the recorded price. A flat discount can never exceed the subtotal.
  return query select
    true,
    null::text,
    case
      when c.percent_off is not null
        then floor(p_subtotal * c.percent_off / 100.0)::bigint
      else least(c.amount_off_paise, p_subtotal)
    end,
    c.description;
end;
$$;

revoke execute on function public.validate_coupon(text, bigint) from public;
grant execute on function public.validate_coupon(text, bigint) to anon, authenticated;

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.addresses      enable row level security;
alter table public.carts          enable row level security;
alter table public.cart_items     enable row level security;
alter table public.wishlists      enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.coupons        enable row level security;

-- Addresses
create policy addresses_owner_all on public.addresses
  for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

-- An order manager needs the delivery address to ship the parcel.
create policy addresses_staff_read on public.addresses
  for select to authenticated
  using (public.has_admin_role(array['order_manager']::public.admin_role[]));

-- Carts. Guest carts are reached by session token through the server, which
-- uses the service role, so there is no anon policy here.
create policy carts_owner_all on public.carts
  for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

create policy cart_items_owner_all on public.cart_items
  for all to authenticated
  using (exists (
    select 1 from public.carts c
    where c.id = cart_id and c.customer_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.carts c
    where c.id = cart_id and c.customer_id = (select auth.uid())
  ));

-- Wishlists
create policy wishlists_owner_all on public.wishlists
  for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

create policy wishlist_items_owner_all on public.wishlist_items
  for all to authenticated
  using (exists (
    select 1 from public.wishlists w
    where w.id = wishlist_id and w.customer_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.wishlists w
    where w.id = wishlist_id and w.customer_id = (select auth.uid())
  ));

-- Coupons: deliberately no read policy for customers. Staff manage them; the
-- validate_coupon function is the only path a shopper has.
create policy coupons_staff_read on public.coupons
  for select to authenticated
  using (public.has_admin_role(array['order_manager', 'support']::public.admin_role[]));

create policy coupons_super_write on public.coupons
  for all to authenticated
  using (public.has_admin_role(array['super_admin']::public.admin_role[]))
  with check (public.has_admin_role(array['super_admin']::public.admin_role[]));
