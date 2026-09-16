-- ============================================================================
-- 0017 — Online payment through CCAvenue.
--
-- What changes, and what deliberately does not.
--
-- `place_order` already prices the order, locks stock and writes the totals.
-- None of that moves. It gains one argument — how the customer intends to pay
-- — and one behaviour: an order that is going to be paid online is left in
-- `pending_payment` instead of being confirmed on the spot.
--
-- Stock is still deducted at placement, not at payment. For a shop where most
-- pieces exist exactly once, the alternative is two people paying for the same
-- saree, and a refund is a worse outcome than a short hold. If the payment is
-- abandoned, `fail_online_payment` puts the stock back.
--
-- THE RULE THIS FILE EXISTS TO ENFORCE:
--
--   An order becomes `confirmed` only through `confirm_online_payment`, which
--   is executable by neither `anon` nor `authenticated`. The browser comes
--   back from CCAvenue carrying a result; that result is a hint. What confirms
--   an order is the server re-asking CCAvenue over its own connection and
--   then calling this function with the service role.
--
--   The amount is checked here too, against `orders.total_paise`. The gateway
--   would have to agree with the database about the price before any order is
--   confirmed, and neither of them takes a figure from the browser.
-- ============================================================================

alter table public.orders
  drop constraint if exists orders_payment_method_known;

alter table public.orders
  add constraint orders_payment_method_known
    check (payment_method in ('cod', 'razorpay', 'ccavenue'));

-- ----------------------------------------------------------------------------
-- The gateway's own reference for the transaction, kept for reconciliation:
-- CCAvenue's `tracking_id` and the acquiring bank's reference. Neither is
-- authoritative for anything — they exist so a disputed payment can be looked
-- up in CCAvenue's dashboard a year later.
-- ----------------------------------------------------------------------------

alter table public.payments
  add column if not exists provider_reference text;

comment on column public.payments.provider_reference is
  'CCAvenue tracking_id / bank reference. Audit trail only, never a gate.';

-- ============================================================================
-- place_order, with the payment method
--
-- Five arguments, and NONE of them defaulted — which is deliberate, and is
-- what makes this migration safe to apply to a running shop.
--
-- The four-argument form below is kept and rewritten as a thin wrapper. The
-- site that is live right now calls `place_order` with four arguments; if this
-- migration dropped that signature, every checkout would break the moment the
-- SQL was applied and stay broken until the new build finished deploying.
-- Keeping both means the order of those two events does not matter.
--
-- The fifth argument has no default precisely so the two cannot be confused:
-- a call naming four arguments can only be the old form, a call naming five
-- can only be the new one. A default on `p_method` would make every
-- four-argument call ambiguous and fail.
-- ============================================================================

create or replace function public.place_order(
  p_items   jsonb,
  p_address jsonb,
  p_coupon  text,
  p_notes   text,
  p_method  text
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
  v_method   text;
  v_online   boolean;
  item       record;
begin
  if v_customer is null then
    raise exception 'Sign in before placing an order.';
  end if;

  -- Decided here, from a fixed list. A client that invents a payment method
  -- gets an error rather than an order nobody knows how to collect money for.
  v_method := lower(btrim(coalesce(p_method, 'cod')));
  if v_method not in ('cod', 'ccavenue') then
    raise exception 'That payment method is not available.';
  end if;
  v_online := v_method <> 'cod';

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

  v_number := public.next_order_number();

  insert into public.orders (
    order_number, customer_id, email, phone, status, payment_method,
    subtotal_paise, discount_paise, shipping_paise, total_paise,
    shipping_address, notes
  )
  values (
    v_number, v_customer, v_email, v_phone, 'pending_payment', v_method,
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
      -- Cash on delivery: the goods are committed and the stock has moved, so
      -- the order is confirmed and the money is owed. Paying online: nothing
      -- is confirmed until the money is actually verified, which happens in
      -- `confirm_online_payment` and nowhere else.
      status         = case when v_online then 'pending_payment'::public.order_status
                            else 'confirmed'::public.order_status end,
      confirmed_at   = case when v_online then null else now() end
  where id = v_order;

  if v_coupon.id is not null then
    insert into public.coupon_usage (coupon_id, order_id, customer_id, discount_paise)
    values (v_coupon.id, v_order, v_customer, v_discount);

    update public.coupons
    set redemption_count = redemption_count + 1
    where id = v_coupon.id;
  end if;

  -- `provider_order_id` is the order number, which is what CCAvenue is handed
  -- as the merchant reference and hands back. The unique index on
  -- (provider, provider_order_id) is what makes a repeated callback harmless.
  insert into public.payments (
    order_id, provider, provider_order_id, status, amount_paise, method
  )
  values (
    v_order, v_method, v_number, 'pending', v_total,
    case when v_online then null else 'cash_on_delivery' end
  );

  return jsonb_build_object(
    'order_id',       v_order,
    'order_number',   v_number,
    'total_paise',    v_total,
    'payment_method', v_method,
    -- The caller uses this to decide between "here is your order" and "now go
    -- and pay". It restates what the database did rather than what was asked.
    'needs_payment',  v_online
  );
end;
$$;

comment on function public.place_order(jsonb, jsonb, text, text, text) is
  'Creates an order from variant ids and quantities. Every amount is read from the database; nothing priced by the client is trusted. COD orders are confirmed here; online orders wait for confirm_online_payment.';

revoke execute on function public.place_order(jsonb, jsonb, text, text, text) from public;
grant execute on function public.place_order(jsonb, jsonb, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- The four-argument form, for whatever is still calling it: the build that is
-- live while this migration is being applied, and anything else that has not
-- been told about payment methods. Cash on delivery, exactly as before.
-- ----------------------------------------------------------------------------

create or replace function public.place_order(
  p_items   jsonb,
  p_address jsonb,
  p_coupon  text default null,
  p_notes   text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.place_order(p_items, p_address, p_coupon, p_notes, 'cod');
$$;

comment on function public.place_order(jsonb, jsonb, text, text) is
  'Compatibility shim for callers that predate payment methods. Places a cash-on-delivery order.';

revoke execute on function public.place_order(jsonb, jsonb, text, text) from public;
grant execute on function public.place_order(jsonb, jsonb, text, text) to authenticated;

-- ============================================================================
-- confirm_online_payment
--
-- The only door into `confirmed` for an order paid online.
--
-- Not granted to `anon` or `authenticated`, and that is the entire security
-- argument. The callback from CCAvenue arrives as a cross-site form POST from
-- the customer's browser, which means no Supabase session cookie rides with it
-- — so the route that handles it holds the service role, server-side, and is
-- the only thing in the system that can reach this function.
--
-- It still does not take the caller's word for the amount.
-- ============================================================================

create or replace function public.confirm_online_payment(
  p_order_id    uuid,
  p_provider    text,
  p_payment_id  text,
  p_amount      bigint,
  p_reference   text default null,
  p_method      text default null,
  p_signature   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.orders%rowtype;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  -- Idempotent. CCAvenue's redirect and any later reconciliation can both
  -- land on the same order; the second one must change nothing rather than
  -- confirm it twice or move stock again.
  if v_order.status <> 'pending_payment' then
    return jsonb_build_object(
      'order_number', v_order.order_number,
      'status',       v_order.status,
      'changed',      false
    );
  end if;

  -- The gateway and the database have to agree about the price. They can only
  -- disagree if the amount was tampered with on the way to CCAvenue, which is
  -- exactly the case this exists to refuse.
  if p_amount is distinct from v_order.total_paise then
    raise exception
      'Paid amount % does not match order % total %',
      p_amount, v_order.order_number, v_order.total_paise;
  end if;

  update public.payments
  set provider            = p_provider,
      provider_payment_id = p_payment_id,
      provider_reference  = p_reference,
      signature           = p_signature,
      method              = coalesce(p_method, method),
      status              = 'paid',
      -- Set here and only here. Nothing downstream may treat a payment as
      -- real without it.
      verified_at         = now()
  where order_id = p_order_id;

  -- Stock was taken at placement, so it is not touched again here.
  update public.orders
  set status       = 'confirmed',
      confirmed_at = now()
  where id = p_order_id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'status',       'confirmed',
    'changed',      true
  );
end;
$$;

comment on function public.confirm_online_payment(uuid, text, text, bigint, text, text, text) is
  'Confirms an online order after the server has verified the payment with the gateway itself. Refuses if the amount disagrees with the order total. Idempotent. Server role only.';

revoke execute on function
  public.confirm_online_payment(uuid, text, text, bigint, text, text, text)
  from public, anon, authenticated;

-- ============================================================================
-- fail_online_payment
--
-- The other half. A payment that was abandoned, declined or never came back
-- leaves stock held for an order nobody is going to pay for, so releasing it
-- is part of the same job rather than something the shop notices next week.
-- ============================================================================

create or replace function public.fail_online_payment(
  p_order_id uuid,
  p_reason   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  -- Never unwind an order that is already paid for. If a late failure notice
  -- arrives for something CCAvenue has already confirmed, the confirmation is
  -- the one to believe and a person should look at it.
  if v_order.status <> 'pending_payment' then
    return jsonb_build_object(
      'order_number', v_order.order_number,
      'status',       v_order.status,
      'changed',      false
    );
  end if;

  update public.payments
  set status         = 'failed',
      failure_reason = p_reason
  where order_id = p_order_id;

  perform public.restore_order_stock(p_order_id);

  update public.orders
  set status       = 'cancelled',
      cancelled_at = now()
  where id = p_order_id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'status',       'cancelled',
    'changed',      true
  );
end;
$$;

comment on function public.fail_online_payment(uuid, text) is
  'Cancels an unpaid online order and returns its stock. Refuses to touch an order that is no longer pending_payment. Server role only.';

revoke execute on function public.fail_online_payment(uuid, text)
  from public, anon, authenticated;
