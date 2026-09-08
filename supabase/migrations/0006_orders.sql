-- ============================================================================
-- 0006 — Orders, payments, shipments.
--
-- The single most important thing in this schema:
--
--   Customers have SELECT on their own orders and nothing else. No INSERT,
--   no UPDATE, no DELETE. Not on orders, not on order_items, not on payments.
--
-- Orders are written by the server using the service role, after it has read
-- prices from `products`, validated the coupon, calculated shipping and
-- created the Razorpay order. A browser cannot create an order at all, so it
-- cannot create one at a price it chose.
--
-- An order is only confirmed once the Razorpay signature verifies server-side
-- AND the webhook agrees. `mark_order_paid` below is the one place that moves
-- an order into `confirmed`, and it is the one place stock moves.
-- ============================================================================

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  -- Human-facing reference, e.g. MR-2026-000148. Set by the server.
  order_number      text not null unique,
  customer_id       uuid references auth.users (id) on delete set null,
  -- Kept for guest checkout and preserved if the account is later deleted, so
  -- an order still has someone to contact about a refund.
  email             text,
  phone             text,

  status            public.order_status not null default 'pending_payment',

  -- The server's own arithmetic, frozen at the moment of pricing.
  subtotal_paise    bigint not null check (subtotal_paise >= 0),
  discount_paise    bigint not null default 0 check (discount_paise >= 0),
  shipping_paise    bigint not null default 0 check (shipping_paise >= 0),
  total_paise       bigint not null check (total_paise >= 0),
  currency          text not null default 'INR' check (currency = 'INR'),

  coupon_id         uuid references public.coupons (id) on delete set null,
  coupon_code       text,

  -- Copied, not referenced. If the customer later edits or deletes the address
  -- in their address book, the record of where this parcel went must not change.
  shipping_address  jsonb not null,
  billing_address   jsonb,

  notes             text,
  placed_at         timestamptz not null default now(),
  confirmed_at      timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint orders_total_adds_up
    check (total_paise = subtotal_paise - discount_paise + shipping_paise),
  constraint orders_discount_within_subtotal
    check (discount_paise <= subtotal_paise)
);

create trigger orders_touch
  before update on public.orders
  for each row execute function public.touch_updated_at();

create index orders_customer_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status);
create index orders_placed_idx on public.orders (placed_at desc);

-- ----------------------------------------------------------------------------
-- Order items
--
-- Product name, SKU and price are copied onto the line rather than joined.
-- An invoice must still read correctly in three years, after the product has
-- been renamed, repriced or archived.
-- ----------------------------------------------------------------------------

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  -- Nullable so a deleted product does not delete the order history.
  product_id        uuid references public.products (id) on delete set null,
  variant_id        uuid references public.product_variants (id) on delete set null,

  product_name      text not null,
  variant_label     text not null default '',
  sku               text not null default '',
  image_url         text,

  unit_price_paise  bigint not null check (unit_price_paise >= 0),
  quantity          integer not null check (quantity > 0),
  line_total_paise  bigint not null check (line_total_paise >= 0),

  created_at        timestamptz not null default now(),

  constraint order_items_line_adds_up
    check (line_total_paise = unit_price_paise * quantity)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- ----------------------------------------------------------------------------
-- Payments
-- ----------------------------------------------------------------------------

create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders (id) on delete cascade,
  provider              text not null default 'razorpay',
  provider_order_id     text not null,
  provider_payment_id   text,
  -- Stored for the audit trail. Verifying it is the server's job; keeping it
  -- means a disputed payment can be re-checked later.
  signature             text,
  status                public.payment_status not null default 'pending',
  amount_paise          bigint not null check (amount_paise >= 0),
  refunded_paise        bigint not null default 0 check (refunded_paise >= 0),
  method                text,
  failure_reason        text,
  -- True only after the signature verified server-side. Nothing downstream may
  -- treat a payment as real without this.
  verified_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint payments_refund_within_amount
    check (refunded_paise <= amount_paise)
);

create trigger payments_touch
  before update on public.payments
  for each row execute function public.touch_updated_at();

create unique index payments_provider_order_idx
  on public.payments (provider, provider_order_id);
create unique index payments_provider_payment_idx
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;
create index payments_order_idx on public.payments (order_id);

-- ----------------------------------------------------------------------------
-- Shipments and tracking
-- ----------------------------------------------------------------------------

create table public.shipments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  provider      text not null,
  awb           text not null,
  tracking_url  text,
  service_code  text,
  shipped_at    timestamptz,
  delivered_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (provider, awb)
);

create trigger shipments_touch
  before update on public.shipments
  for each row execute function public.touch_updated_at();

create index shipments_order_idx on public.shipments (order_id);

create table public.tracking_events (
  id          uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  status      text not null,
  description text not null default '',
  location    text,
  occurred_at timestamptz not null,
  created_at  timestamptz not null default now(),
  -- The courier replays events; this makes ingestion idempotent.
  unique (shipment_id, status, occurred_at)
);

create index tracking_events_shipment_idx
  on public.tracking_events (shipment_id, occurred_at desc);

-- ----------------------------------------------------------------------------
-- Coupon usage — one row per redemption, so per-customer limits are provable
-- ----------------------------------------------------------------------------

create table public.coupon_usage (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references public.coupons (id) on delete cascade,
  order_id    uuid not null references public.orders (id) on delete cascade,
  customer_id uuid references auth.users (id) on delete set null,
  discount_paise bigint not null check (discount_paise >= 0),
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create index coupon_usage_customer_idx on public.coupon_usage (customer_id);

-- ============================================================================
-- Stock movement
--
-- Called by the server once, after a payment has verified. SECURITY DEFINER so
-- it can write inventory that no customer role may touch, and it takes a row
-- lock per variant so two concurrent confirmations cannot oversell the same
-- last unit.
-- ============================================================================

create or replace function public.mark_order_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  current_status public.order_status;
begin
  select status into current_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  -- Idempotent: a Razorpay webhook may arrive twice, or race the redirect.
  -- Confirming an already-confirmed order must not deduct stock again.
  if current_status <> 'pending_payment' then
    return;
  end if;

  for item in
    select variant_id, quantity
    from public.order_items
    where order_id = p_order_id and variant_id is not null
  loop
    update public.inventory
    set on_hand = on_hand - item.quantity
    where variant_id = item.variant_id;

    if not found then
      raise exception 'No inventory row for variant %', item.variant_id;
    end if;
  end loop;

  update public.orders
  set status = 'confirmed', confirmed_at = now()
  where id = p_order_id;
end;
$$;

comment on function public.mark_order_paid(uuid) is
  'Confirms an order and deducts stock. Call only after the Razorpay signature has verified server-side. Idempotent.';

-- Deliberately not granted to anon or authenticated. Server only.
revoke execute on function public.mark_order_paid(uuid) from public;

-- Returns stock when an order is cancelled or refunded.
create or replace function public.restore_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
begin
  for item in
    select variant_id, quantity
    from public.order_items
    where order_id = p_order_id and variant_id is not null
  loop
    update public.inventory
    set on_hand = on_hand + item.quantity
    where variant_id = item.variant_id;
  end loop;
end;
$$;

revoke execute on function public.restore_order_stock(uuid) from public;

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.payments        enable row level security;
alter table public.shipments       enable row level security;
alter table public.tracking_events enable row level security;
alter table public.coupon_usage    enable row level security;

-- Orders: customers read their own. No write policy of any kind for them.
create policy orders_owner_read on public.orders
  for select to authenticated
  using (customer_id = (select auth.uid()));

create policy orders_staff_read on public.orders
  for select to authenticated
  using (public.has_admin_role(
    array['order_manager', 'support']::public.admin_role[]
  ));

-- Only an order manager moves an order through the pipeline, and only from the
-- admin. Support is read-only by design.
create policy orders_staff_update on public.orders
  for update to authenticated
  using (public.has_admin_role(array['order_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['order_manager']::public.admin_role[]));

create policy order_items_owner_read on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_id = (select auth.uid())
  ));

create policy order_items_staff_read on public.order_items
  for select to authenticated
  using (public.has_admin_role(
    array['order_manager', 'support']::public.admin_role[]
  ));

-- Payments: readable by the customer so an order page can show its state.
-- Writable by nobody but the service role.
create policy payments_owner_read on public.payments
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_id = (select auth.uid())
  ));

create policy payments_staff_read on public.payments
  for select to authenticated
  using (public.has_admin_role(
    array['order_manager', 'support']::public.admin_role[]
  ));

create policy shipments_owner_read on public.shipments
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_id = (select auth.uid())
  ));

create policy shipments_staff_all on public.shipments
  for all to authenticated
  using (public.has_admin_role(array['order_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['order_manager']::public.admin_role[]));

create policy tracking_events_owner_read on public.tracking_events
  for select to authenticated
  using (exists (
    select 1
    from public.shipments s
    join public.orders o on o.id = s.order_id
    where s.id = shipment_id and o.customer_id = (select auth.uid())
  ));

create policy tracking_events_staff_read on public.tracking_events
  for select to authenticated
  using (public.has_admin_role(
    array['order_manager', 'support']::public.admin_role[]
  ));

create policy coupon_usage_staff_read on public.coupon_usage
  for select to authenticated
  using (public.has_admin_role(
    array['order_manager', 'super_admin']::public.admin_role[]
  ));

-- ============================================================================
-- Column-level privileges
--
-- RLS decides which rows you may touch; it cannot decide which columns. An
-- order manager legitimately moves an order through the pipeline, but must
-- never be able to rewrite what it cost.
--
-- So: revoke UPDATE wholesale and grant it back only on the operational
-- columns. The money columns are then unwritable by any client role, and the
-- only path to them is the service role on the server.
-- ============================================================================

revoke update on public.orders from anon, authenticated;
grant update (status, notes, cancelled_at) on public.orders to authenticated;

-- Order lines are immutable once written. Editing an order means cancelling
-- and re-placing it, which leaves a trail; silently editing a line does not.
revoke insert, update, delete on public.order_items from anon, authenticated;

-- Payments are written only by the server, after verifying a signature.
revoke insert, update, delete on public.payments from anon, authenticated;

-- Shipment identifiers come from the courier and are set by the integration.
revoke update on public.shipments from anon, authenticated;
grant update (tracking_url, shipped_at, delivered_at)
  on public.shipments to authenticated;

revoke insert, update, delete on public.tracking_events from anon, authenticated;
revoke insert, update, delete on public.coupon_usage from anon, authenticated;
