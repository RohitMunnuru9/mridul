-- ============================================================================
-- 0018 — The admin side of an order that is paid online.
--
-- Two things, and the first is a bug that 0017 introduced.
--
-- ---------------------------------------------------------------------------
-- 1. A cancelled online order was losing its stock for good.
--
-- `admin_set_order_status` in 0016 restored stock on cancellation UNLESS the
-- order was still `pending_payment`, and the reasoning was sound at the time:
-- under 0016 `place_order` confirmed every order on the spot, so an order
-- sitting in `pending_payment` was one that had never taken stock out.
--
-- 0017 broke that assumption without noticing. An online order now waits in
-- `pending_payment` while it HOLDS the stock that was deducted when it was
-- placed. Cancelling one took the piece out of inventory permanently — no
-- error, no trace, just a saree that the shop still owns and the site will
-- never sell again.
--
-- Every order `place_order` has ever written deducts stock at placement, in
-- both versions. So the exception is simply wrong now, and it goes.
--
-- ---------------------------------------------------------------------------
-- 2. An unpaid order could be marched to `shipped`.
--
-- Nothing stopped an order manager selecting "Shipped" on an online order
-- whose money never arrived. The admin offered the whole pipeline for any
-- order, and the database accepted it.
--
-- The rule added below: an order paid online cannot leave `pending_payment`
-- for anywhere except an exit (cancelled / returned / refunded) until its
-- payment row says `paid` AND carries a `verified_at` — which only
-- `confirm_online_payment` sets, and only after the server has asked CCAvenue
-- directly. Cash on delivery is untouched: there is nothing to verify before
-- dispatch, which is the whole point of it.
--
-- The check is here rather than in the admin because the admin is a UI. This
-- is the thing that has to be true even if somebody posts the form by hand.
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
  v_current  public.order_status;
  v_method   text;
  v_paid     boolean;
  v_closed   constant public.order_status[] :=
    array['cancelled', 'returned', 'refunded']::public.order_status[];
begin
  if not public.has_admin_role(array['order_manager']::public.admin_role[]) then
    raise exception 'You cannot change orders.';
  end if;

  select o.status, o.payment_method into v_current, v_method
  from public.orders o
  where o.id = p_order_id
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

  -- ------------------------------------------------------------------------
  -- Money before dispatch, for anything not paid at the door.
  --
  -- `verified_at` is the load-bearing half of this test. A `status` of 'paid'
  -- could in principle be set by some future code path; `verified_at` is
  -- written in exactly one place, after the server has asked the gateway
  -- itself. Requiring both means a row that merely looks paid is not enough.
  -- ------------------------------------------------------------------------
  if v_method <> 'cod'
     and v_current = 'pending_payment'
     and not (p_status = any (v_closed)) then

    select exists (
      select 1
      from public.payments p
      where p.order_id = p_order_id
        and p.status = 'paid'
        and p.verified_at is not null
    ) into v_paid;

    if not v_paid then
      raise exception
        'This order has not been paid for yet, so it cannot be moved to %. Cancel it instead, or wait for the payment to be confirmed.',
        p_status;
    end if;
  end if;

  -- Stock goes back on the first move into a status that means the pieces are
  -- on the shelf again. Every order `place_order` writes deducts stock as it
  -- is placed — including an online order still waiting to be paid for — so
  -- there is no longer any state that should be skipped here. (0016 skipped
  -- `pending_payment`; see the note at the top of this file for why that was
  -- right then and wrong now.)
  if p_status = any (v_closed) then
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
  'Moves an order through the pipeline. Refuses to dispatch an online order whose payment has not been verified, returns stock on any exit, and settles a cash payment on delivery. Order managers only.';

revoke execute on function public.admin_set_order_status(uuid, public.order_status)
  from public;
grant execute on function public.admin_set_order_status(uuid, public.order_status)
  to authenticated;

-- ============================================================================
-- Retrying a payment
--
-- A customer whose card was declined has an order sitting in `pending_payment`
-- and, until now, no way back to it: the checkout would build them a second
-- order and hold a second piece of stock for the same saree.
--
-- This lets the storefront find the order it should send them back to the
-- gateway with. It is readable under the customer's own session — RLS on
-- `orders` already restricts that to their own rows, so no new exposure — and
-- it deliberately returns nothing but what the payment page needs.
-- ============================================================================

create or replace function public.my_unpaid_order(p_order_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
           'order_id',     o.id,
           'order_number', o.order_number,
           'total_paise',  o.total_paise,
           'placed_at',    o.placed_at
         )
  from public.orders o
  where o.status = 'pending_payment'
    and o.payment_method <> 'cod'
    and (p_order_id is null or o.id = p_order_id)
  order by o.placed_at desc
  limit 1;
$$;

comment on function public.my_unpaid_order(uuid) is
  'The caller''s most recent order that is still waiting to be paid online. SECURITY INVOKER: row-level security decides whose orders these are.';

revoke execute on function public.my_unpaid_order(uuid) from public;
grant execute on function public.my_unpaid_order(uuid) to authenticated;
