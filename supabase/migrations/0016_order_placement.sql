-- ============================================================================
-- 0016 — Placing an order, and reading customers in the admin.
--
-- 0006 gave customers SELECT on their own orders and nothing else: no INSERT
-- on orders, order_items, payments or inventory. That is still true after this
-- migration. What changes is that there is now one named way to ask the
-- database to create an order — `place_order` — and it prices the order
-- itself.
--
-- Read `place_order` as a list of things the browser is NOT allowed to decide:
--
--   * not the unit price      — read from products + product_variants
--   * not the discount        — validate_coupon decides, from the server's own
--                               subtotal, not the one the page displayed
--   * not the shipping charge — read from settings
--   * not the total           — arithmetic here, checked again by the
--                               orders_total_adds_up constraint
--   * not the stock           — locked and decremented row by row, so two
--                               checkouts cannot both take the last piece
--   * not the status          — set here
--
-- The browser chooses which variant and how many. Everything else it sends is
-- ignored or re-derived.
--
-- Payment: until Razorpay is wired up the shop collects cash on delivery, so
-- an order is written `confirmed` (the goods are committed and stock moves)
-- with a `payments` row that is honestly still `pending` — no money has been
-- taken. When Razorpay arrives it creates orders at `pending_payment` instead
-- and `mark_order_paid` moves them, exactly as 0006 describes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- How the order is being paid for. Recorded on the order because a year from
-- now "was this one cash at the door?" is a question the packing slip has to
-- answer without a join.
-- ----------------------------------------------------------------------------

alter table public.orders
  add column if not exists payment_method text not null default 'cod';

alter table public.orders
  drop constraint if exists orders_payment_method_known;

alter table public.orders
  add constraint orders_payment_method_known
    check (payment_method in ('cod', 'razorpay'));

-- ----------------------------------------------------------------------------
-- `orders.notes` is the customer's note, written once at checkout. The shop
-- needs somewhere of its own to write "called, delivering Saturday" without
-- overwriting what the customer said, so it gets a second column rather than
-- sharing one.
-- ----------------------------------------------------------------------------

alter table public.orders
  add column if not exists staff_notes text;

-- Staff may correct the payment method (a cash order later paid by link) and
-- write their own notes, so those join the small set of columns an order
-- manager can write. The money columns stay unwritable by every client role,
-- as in 0006 — and `notes` stays as the customer wrote it.
grant update (payment_method, staff_notes) on public.orders to authenticated;

-- ============================================================================
-- place_order
--
-- SECURITY DEFINER and granted to `authenticated`. That reads like a widening
-- of 0006 and is the opposite of one: the customer still cannot write a single
-- row of any of these tables directly. They can only ask for this exact
-- transaction, with these exact checks, at prices they do not control.
-- ============================================================================

create or replace function public.place_order(
  p_items   jsonb,
  p_address jsonb,
  p_coupon  text default null,
  p_notes   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := (select auth.uid());
  v_email    text;
  v_name     text;
  v_phone    text;
  v_pincode  text;
  v_address  jsonb;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_shipping bigint := 0;
  v_total    bigint := 0;
  v_free_at  bigint;
  v_flat     bigint;
  v_coupon   public.coupons%rowtype;
  v_check    record;
  v_piece    record;
  v_order    uuid;
  v_number   text;
  v_stock    integer;
  v_image    text;
  item       record;
begin
  if v_customer is null then
    raise exception 'Sign in before placing an order.';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Your bag is empty.';
  end if;

  if jsonb_array_length(p_items) > 20 then
    raise exception 'An order can hold at most 20 different pieces.';
  end if;

  -- --------------------------------------------------------------------------
  -- The address. Validated here and rebuilt key by key, so an extra field the
  -- client invented is dropped rather than frozen onto the order.
  -- --------------------------------------------------------------------------

  v_name    := btrim(coalesce(p_address ->> 'full_name', ''));
  v_phone   := btrim(coalesce(p_address ->> 'phone', ''));
  v_pincode := btrim(coalesce(p_address ->> 'pincode', ''));

  if length(v_name) < 2 then
    raise exception 'Enter the name of whoever is receiving the order.';
  end if;
  if v_phone !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit Indian mobile number.';
  end if;
  if length(btrim(coalesce(p_address ->> 'line1', ''))) < 5 then
    raise exception 'Enter the house number and street.';
  end if;
  if btrim(coalesce(p_address ->> 'city', '')) = ''
     or btrim(coalesce(p_address ->> 'state', '')) = '' then
    raise exception 'Enter the city and state.';
  end if;
  if v_pincode !~ '^[1-9][0-9]{5}$' then
    raise exception 'Enter a valid 6-digit Indian pincode.';
  end if;

  v_address := jsonb_build_object(
    'full_name', v_name,
    'phone',     v_phone,
    'line1',     btrim(p_address ->> 'line1'),
    'line2',     nullif(btrim(coalesce(p_address ->> 'line2', '')), ''),
    'landmark',  nullif(btrim(coalesce(p_address ->> 'landmark', '')), ''),
    'city',      btrim(p_address ->> 'city'),
    'state',     btrim(p_address ->> 'state'),
    'pincode',   v_pincode,
    'country',   'IN'
  );

  select u.email::text into v_email from auth.users u where u.id = v_customer;

  -- --------------------------------------------------------------------------
  -- The order shell, so the lines have something to hang off. Totals are zero
  -- for the moment and are written once the lines are priced; the
  -- orders_total_adds_up constraint is satisfied at every step.
  -- --------------------------------------------------------------------------

  v_number := public.next_order_number();

  insert into public.orders (
    order_number, customer_id, email, phone, status, payment_method,
    subtotal_paise, discount_paise, shipping_paise, total_paise,
    shipping_address, notes
  )
  values (
    v_number, v_customer, v_email, v_phone, 'pending_payment', 'cod',
    0, 0, 0, 0, v_address, nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_order;

  -- --------------------------------------------------------------------------
  -- The lines. Grouped by variant first, so a bag that somehow lists the same
  -- variant twice becomes one line with the right quantity rather than two
  -- lines that each pass the per-line limit.
  -- --------------------------------------------------------------------------

  for item in
    select (e ->> 'variant_id')::uuid as variant_id,
           sum(coalesce((e ->> 'quantity')::integer, 0))::integer as quantity
    from jsonb_array_elements(p_items) as e
    group by 1
  loop
    if item.variant_id is null then
      raise exception 'Your bag could not be read. Refresh the page and try again.';
    end if;
    if item.quantity < 1 or item.quantity > 10 then
      raise exception 'Choose between 1 and 10 of each piece.';
    end if;

    select v.sku,
           v.label,
           v.is_active as variant_active,
           p.id        as product_id,
           p.name      as product_name,
           p.is_active as product_active,
           (p.price_paise + v.price_delta_paise) as unit_price
      into v_piece
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = item.variant_id;

    if not found then
      raise exception 'One of the pieces in your bag is no longer available.';
    end if;
    if not v_piece.variant_active or not v_piece.product_active then
      raise exception '% is no longer available.', v_piece.product_name;
    end if;
    if v_piece.unit_price <= 0 then
      raise exception '% has no price set, so it cannot be ordered yet.',
        v_piece.product_name;
    end if;

    -- The row lock is the whole point: two checkouts reaching the last piece
    -- at the same moment queue here, and the second one sees the decremented
    -- figure rather than the one it read a second ago.
    select i.on_hand into v_stock
    from public.inventory i
    where i.variant_id = item.variant_id
    for update;

    if not found then
      raise exception 'Stock has not been set up for %.', v_piece.product_name;
    end if;
    if v_stock < item.quantity then
      raise exception 'Only % left of % (%).',
        v_stock, v_piece.product_name, v_piece.label;
    end if;

    update public.inventory
    set on_hand = on_hand - item.quantity
    where variant_id = item.variant_id;

    -- Stored as `bucket/path`, which is what both apps resolve into a URL. A
    -- full URL would rot the day the project reference changes.
    select m.bucket || '/' || m.path into v_image
    from public.product_images pi
    join public.media m on m.id = pi.media_id
    where pi.product_id = v_piece.product_id
    order by pi.position
    limit 1;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, variant_label, sku,
      image_url, unit_price_paise, quantity, line_total_paise
    )
    values (
      v_order, v_piece.product_id, item.variant_id, v_piece.product_name,
      v_piece.label, v_piece.sku, v_image,
      v_piece.unit_price, item.quantity, v_piece.unit_price * item.quantity
    );

    v_subtotal := v_subtotal + v_piece.unit_price * item.quantity;
  end loop;

  -- --------------------------------------------------------------------------
  -- Discount and shipping, both decided here from the server's own subtotal.
  -- --------------------------------------------------------------------------

  if p_coupon is not null and btrim(p_coupon) <> '' then
    select * into v_check from public.validate_coupon(p_coupon, v_subtotal);
    if not v_check.ok then
      raise exception '%', v_check.reason;
    end if;
    v_discount := v_check.discount_paise;
    select * into v_coupon
    from public.coupons
    where lower(code) = lower(btrim(p_coupon));
  end if;

  select s.free_shipping_threshold_paise, s.flat_shipping_paise
    into v_free_at, v_flat
  from public.settings s
  limit 1;

  v_free_at  := coalesce(v_free_at, 199900);
  v_flat     := coalesce(v_flat, 9900);
  v_shipping := case
                  when (v_subtotal - v_discount) >= v_free_at then 0
                  else v_flat
                end;
  v_total    := v_subtotal - v_discount + v_shipping;

  update public.orders
  set subtotal_paise = v_subtotal,
      discount_paise = v_discount,
      shipping_paise = v_shipping,
      total_paise    = v_total,
      coupon_id      = v_coupon.id,
      coupon_code    = v_coupon.code,
      -- Cash on delivery: the goods are committed and stock has moved, so the
      -- order is confirmed. The money is still owed, which is what the
      -- payments row below records.
      status         = 'confirmed',
      confirmed_at   = now()
  where id = v_order;

  if v_coupon.id is not null then
    insert into public.coupon_usage (coupon_id, order_id, customer_id, discount_paise)
    values (v_coupon.id, v_order, v_customer, v_discount);

    update public.coupons
    set redemption_count = redemption_count + 1
    where id = v_coupon.id;
  end if;

  insert into public.payments (
    order_id, provider, provider_order_id, status, amount_paise, method
  )
  values (
    v_order, 'cod', v_number, 'pending', v_total, 'cash_on_delivery'
  );

  return jsonb_build_object(
    'order_id',     v_order,
    'order_number', v_number,
    'total_paise',  v_total
  );
end;
$$;

comment on function public.place_order(jsonb, jsonb, text, text) is
  'Creates an order from variant ids and quantities. Every amount is read from the database; nothing priced by the client is trusted. Cash on delivery until Razorpay is connected.';

revoke execute on function public.place_order(jsonb, jsonb, text, text) from public;
grant execute on function public.place_order(jsonb, jsonb, text, text) to authenticated;

-- ============================================================================
-- admin_customers
--
-- The admin needs the customer list with the details that only live in
-- `auth.users` — the email, when they signed up, when they last signed in and
-- how. No client role can read that schema, and handing the admin app the
-- service-role key to get at it would let that app bypass every policy in this
-- database for the sake of one screen.
--
-- So: one SECURITY DEFINER function that reads exactly those columns, checks
-- the caller's role itself, and returns nothing to anyone else.
-- ============================================================================

create or replace function public.admin_customers()
returns table (
  id                 uuid,
  email              text,
  full_name          text,
  phone              text,
  signed_up_at       timestamptz,
  last_sign_in_at    timestamptz,
  email_confirmed_at timestamptz,
  sign_in_method     text,
  is_staff           boolean,
  accepts_marketing  boolean,
  orders_count       bigint,
  spend_paise        bigint,
  last_order_at      timestamptz,
  city               text,
  state              text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role(
       array['order_manager', 'support']::public.admin_role[]
     ) then
    raise exception 'Not authorised.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(p.full_name, u.raw_user_meta_data ->> 'full_name'),
    coalesce(p.phone, u.phone::text),
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    exists (select 1 from public.admin_roles ar where ar.user_id = u.id),
    coalesce(p.accepts_marketing, false),
    count(o.id),
    -- Cancelled, returned and refunded orders are not spend.
    coalesce(
      sum(o.total_paise) filter (
        where o.status not in ('cancelled', 'returned', 'refunded')
      ),
      0
    )::bigint,
    max(o.placed_at),
    (select a.city  from public.addresses a where a.customer_id = u.id
      order by a.is_default desc, a.created_at desc limit 1),
    (select a.state from public.addresses a where a.customer_id = u.id
      order by a.is_default desc, a.created_at desc limit 1)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.orders o on o.customer_id = u.id
  group by u.id, u.email, p.full_name, u.raw_user_meta_data, p.phone, u.phone,
           p.accepts_marketing, u.created_at, u.last_sign_in_at,
           u.email_confirmed_at, u.raw_app_meta_data
  order by u.created_at desc;
end;
$$;

comment on function public.admin_customers() is
  'Customer list for the admin, including the auth.users columns no client role can read. Refuses anyone without order_manager or support.';

revoke execute on function public.admin_customers() from public;
grant execute on function public.admin_customers() to authenticated;

-- ============================================================================
-- admin_set_order_status
--
-- 0006 already lets an order manager update `orders.status` directly, and that
-- is still true. This exists because the status is not the only thing that
-- moves when an order is cancelled:
--
--   * stock that came out when the order was confirmed has to go back, and
--     `inventory` is writable by no client role at all;
--   * a cash order that reaches `delivered` has been paid, and `payments` is
--     writable by no client role either.
--
-- Doing those three things in one transaction is the difference between a
-- cancelled order and a cancelled order that quietly lost a saree.
-- ============================================================================

create or replace function public.admin_set_order_status(
  p_order_id uuid,
  p_status   public.order_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.order_status;
  v_method  text;
  v_closed  constant public.order_status[] :=
    array['cancelled', 'returned', 'refunded']::public.order_status[];
begin
  if not public.has_admin_role(array['order_manager']::public.admin_role[]) then
    raise exception 'You cannot change orders.';
  end if;

  select status, payment_method into v_current, v_method
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'That order no longer exists.';
  end if;

  if v_current = p_status then
    return;
  end if;

  -- Reopening would have to take stock out again, and there is no guarantee it
  -- is still there to take. Placing a fresh order leaves a trail; silently
  -- reviving one does not.
  if v_current = any (v_closed) then
    raise exception 'A % order cannot be reopened. Place a new order instead.',
      v_current;
  end if;

  -- Stock goes back exactly once, on the first move into a status that means
  -- the pieces are on the shelf again. An order that never reached confirmed
  -- never had stock taken out, so nothing is returned for it.
  if p_status = any (v_closed) and v_current <> 'pending_payment' then
    perform public.restore_order_stock(p_order_id);
  end if;

  -- Cash on delivery is collected at the door, so delivery is the moment the
  -- payment becomes real. `verified_at` stays null: there is no signature to
  -- verify, and pretending otherwise would make the audit trail a lie.
  if p_status = 'delivered' and v_method = 'cod' then
    update public.payments
    set status = 'paid'
    where order_id = p_order_id and status <> 'paid';
  end if;

  update public.orders
  set status = p_status,
      cancelled_at = case
                       when p_status = 'cancelled' then now()
                       else cancelled_at
                     end
  where id = p_order_id;
end;
$$;

comment on function public.admin_set_order_status(uuid, public.order_status) is
  'Moves an order through the pipeline, returning stock on cancellation and settling a cash payment on delivery. Order managers only.';

revoke execute on function public.admin_set_order_status(uuid, public.order_status)
  from public;
grant execute on function public.admin_set_order_status(uuid, public.order_status)
  to authenticated;
