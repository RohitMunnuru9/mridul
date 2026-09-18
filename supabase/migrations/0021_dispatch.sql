-- ============================================================================
-- 0021 — Handing a parcel to the courier.
--
-- The tables for this have existed since 0006: `shipments` holds the courier,
-- the AWB and a tracking link, `tracking_events` holds the journey. Neither
-- app has ever written a row to either of them.
--
-- Meanwhile the site tells the customer, twice — on the order page and in the
-- help panel — that they will be sent a tracking number and can watch the
-- parcel's progress. That is a promise the shop currently has no way to keep.
-- This is the missing half.
--
-- The rules live here rather than in the admin, for the same reason as
-- everything else in this schema: the admin is a UI, and these are the things
-- that must hold even if somebody posts the form by hand.
--
--   1. Only an order manager may dispatch.
--   2. An order that has not been paid for cannot be dispatched. This is the
--      same test 0018 applies to the status dropdown — a parcel leaving the
--      shop is a stronger commitment than a status change, so it would be odd
--      for it to be the easier of the two.
--   3. A closed order cannot be dispatched, and one still waiting for payment
--      cannot either.
--   4. An AWB already used on another order is refused. `shipments` has
--      `unique (provider, awb)` and that is exactly the typo it exists to
--      catch: the same tracking number pasted onto two parcels means one
--      customer watches somebody else's.
-- ============================================================================

create or replace function public.admin_record_dispatch(
  p_order_id     uuid,
  p_provider     text,
  p_awb          text,
  p_tracking_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order    public.orders%rowtype;
  v_provider text;
  v_awb      text;
  v_url      text;
  v_paid     boolean;
  v_shipment uuid;
begin
  if not public.has_admin_role(array['order_manager']::public.admin_role[]) then
    raise exception 'You cannot dispatch orders.';
  end if;

  -- --------------------------------------------------------------------------
  -- What was typed, tidied. Trimmed before the length checks, so a field of
  -- spaces is empty rather than valid.
  -- --------------------------------------------------------------------------
  v_provider := btrim(coalesce(p_provider, ''));
  v_awb      := btrim(coalesce(p_awb, ''));
  v_url      := nullif(btrim(coalesce(p_tracking_url, '')), '');

  if length(v_provider) < 2 then
    raise exception 'Enter the courier''s name.';
  end if;
  if length(v_provider) > 60 then
    raise exception 'That courier name is too long.';
  end if;
  if length(v_awb) < 4 then
    raise exception 'Enter the tracking number the courier gave you.';
  end if;
  if length(v_awb) > 60 then
    raise exception 'That tracking number is too long.';
  end if;
  -- A tracking link is shown to the customer and is clicked from their order
  -- page, so it may only ever be http(s). Anything else — a javascript: URL
  -- most of all — has no business being put in front of them.
  if v_url is not null and v_url !~* '^https?://' then
    raise exception 'A tracking link must start with http:// or https://';
  end if;
  if length(coalesce(v_url, '')) > 500 then
    raise exception 'That tracking link is too long.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'That order no longer exists.';
  end if;

  if v_order.status in ('cancelled', 'returned', 'refunded') then
    raise exception 'A % order cannot be dispatched.', v_order.status;
  end if;

  if v_order.status = 'pending_payment' then
    raise exception
      'This order has not been paid for yet. Nothing should leave the shop until it is.';
  end if;

  -- Belt and braces on top of the status check: an order could in principle
  -- have been moved past pending_payment by some future path, and a parcel is
  -- not something to send on the strength of a status column alone.
  if v_order.payment_method <> 'cod' then
    select exists (
      select 1 from public.payments p
      where p.order_id = p_order_id
        and p.status = 'paid'
        and p.verified_at is not null
    ) into v_paid;

    if not v_paid then
      raise exception
        'This order was to be paid online and the payment has not been verified. Do not dispatch it yet.';
    end if;
  end if;

  -- --------------------------------------------------------------------------
  -- The shipment. One per order: correcting a tracking number that was typed
  -- wrongly should mend the record, not leave two and let the customer guess.
  -- --------------------------------------------------------------------------
  select id into v_shipment
  from public.shipments
  where order_id = p_order_id
  order by created_at
  limit 1;

  if v_shipment is null then
    begin
      insert into public.shipments (order_id, provider, awb, tracking_url, shipped_at)
      values (p_order_id, v_provider, v_awb, v_url, now())
      returning id into v_shipment;
    exception when unique_violation then
      raise exception
        'Tracking number % is already on another order. Check the courier''s slip.',
        v_awb;
    end;
  else
    begin
      update public.shipments
      set provider     = v_provider,
          awb          = v_awb,
          tracking_url = v_url,
          shipped_at   = coalesce(shipped_at, now())
      where id = v_shipment;
    exception when unique_violation then
      raise exception
        'Tracking number % is already on another order. Check the courier''s slip.',
        v_awb;
    end;
  end if;

  -- The first thing the customer sees on the journey. Later events would come
  -- from the courier; this one is the shop's own, and says something true
  -- without pretending to know where the parcel is.
  insert into public.tracking_events (shipment_id, status, description, occurred_at)
  values (v_shipment, 'handed_over',
          'Handed to ' || v_provider || ' for delivery.', now())
  on conflict (shipment_id, status, occurred_at) do nothing;

  -- Moving the order on is part of dispatching it, not a second thing to
  -- remember. An order already further along keeps where it is.
  if v_order.status in ('confirmed', 'processing', 'packed') then
    update public.orders set status = 'shipped' where id = p_order_id;
  end if;

  return jsonb_build_object(
    'shipment_id', v_shipment,
    'provider',    v_provider,
    'awb',         v_awb,
    'tracking_url', v_url
  );
end;
$$;

comment on function public.admin_record_dispatch(uuid, text, text, text) is
  'Records the courier and tracking number for an order, marks it shipped, and refuses to dispatch anything unpaid. Order managers only.';

revoke execute on function public.admin_record_dispatch(uuid, text, text, text) from public;
grant execute on function public.admin_record_dispatch(uuid, text, text, text)
  to authenticated;

-- ============================================================================
-- Marking it delivered.
--
-- Separate from the status dropdown because delivery closes two things at
-- once: the parcel's journey and, for a cash order, the money. Doing it in one
-- place means the shipment and the order cannot disagree about when it
-- arrived.
-- ============================================================================

create or replace function public.admin_mark_delivered(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role(array['order_manager']::public.admin_role[]) then
    raise exception 'You cannot change orders.';
  end if;

  update public.shipments
  set delivered_at = coalesce(delivered_at, now())
  where order_id = p_order_id;

  -- Everything else about delivery — settling a cash payment, refusing to
  -- reopen a closed order — already lives in admin_set_order_status, so this
  -- calls it rather than writing a second copy that could drift.
  perform public.admin_set_order_status(p_order_id, 'delivered'::public.order_status);
end;
$$;

comment on function public.admin_mark_delivered(uuid) is
  'Closes the shipment and moves the order to delivered, settling a cash payment through admin_set_order_status. Order managers only.';

revoke execute on function public.admin_mark_delivered(uuid) from public;
grant execute on function public.admin_mark_delivered(uuid) to authenticated;
