-- ============================================================================
-- 0024 — Returns.
--
-- The help panel has told every customer: "Yes — within 7 days of delivery,
-- as long as the piece is unworn and still has its tags. Tell us what went
-- wrong and we will arrange it." There has never been anywhere to tell us.
-- No table, no form, nothing. A customer with a damaged saree had to guess at
-- an email address.
--
-- What a return means here, concretely:
--
--   1. The customer asks, from their order page, choosing WHICH pieces and
--      saying why. Only a delivered order, only inside the window, only their
--      own — all decided in `request_return`, not in the page.
--   2. The shop approves or declines. Approving puts THOSE pieces back into
--      stock — not the whole order, which is what the old exit did — and moves
--      the order to `returned` only if everything on it has come back.
--   3. The shop records the refund when the money has actually gone. For a
--      cash order that is a person handing over notes; for a card order it is
--      done in CCAvenue's dashboard. Neither happens here, so this only writes
--      down that it happened and how much.
--
-- Nothing is writable by any client role. Every change goes through a function
-- that checks the rule it exists for.
--
-- ---------------------------------------------------------------------------
-- A correctness fix that this needed and the shop already needed
--
-- `restore_order_stock` (0006) puts every line of an order back on the shelf.
-- It is called when an order is cancelled, and it was right for that. It is
-- wrong the moment a return can be partial: approve one blouse back, then
-- later cancel or return the order through the dropdown, and that blouse is
-- restocked twice. Inventory then says two where there is one — the same
-- silent oversell the stock-save fix in 0019 closed from the other side.
--
-- So order lines now remember how much of them has already been restocked,
-- and `restore_order_stock` restores only the remainder. Cancelling a fresh
-- order behaves exactly as before; the difference only appears once
-- something has been partially returned.
-- ============================================================================

alter table public.order_items
  add column if not exists restocked_quantity integer not null default 0
    check (restocked_quantity >= 0);

alter table public.order_items
  drop constraint if exists order_items_restocked_within_quantity;

alter table public.order_items
  add constraint order_items_restocked_within_quantity
    check (restocked_quantity <= quantity);

-- ----------------------------------------------------------------------------
-- Put some of one line back on the shelf, and remember that it was done.
--
-- Not granted to anybody. Called by the two functions below and by
-- `restore_order_stock`, each of which has already checked who is asking.
-- ----------------------------------------------------------------------------
create or replace function public.restock_order_item(
  p_order_item_id uuid,
  p_quantity      integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item   public.order_items%rowtype;
  v_amount integer;
begin
  select * into v_item
  from public.order_items
  where id = p_order_item_id
  for update;

  if not found then
    return 0;
  end if;

  -- Never more than is still out. A second call for the same line is a
  -- no-op rather than a second restock.
  v_amount := least(greatest(p_quantity, 0), v_item.quantity - v_item.restocked_quantity);
  if v_amount = 0 then
    return 0;
  end if;

  if v_item.variant_id is not null then
    update public.inventory
    set on_hand = on_hand + v_amount
    where variant_id = v_item.variant_id;
  end if;

  update public.order_items
  set restocked_quantity = restocked_quantity + v_amount
  where id = p_order_item_id;

  return v_amount;
end;
$$;

revoke execute on function public.restock_order_item(uuid, integer) from public;

-- Same name, same callers, now idempotent: restores whatever is still out.
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
    select id, quantity, restocked_quantity
    from public.order_items
    where order_id = p_order_id
  loop
    perform public.restock_order_item(item.id, item.quantity - item.restocked_quantity);
  end loop;
end;
$$;

revoke execute on function public.restore_order_stock(uuid) from public;

-- ============================================================================
-- The tables
-- ============================================================================

create type public.return_status as enum (
  'requested',
  'approved',
  'declined',
  'refunded'
);

create table public.return_requests (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  customer_id   uuid references auth.users (id) on delete set null,
  status        public.return_status not null default 'requested',
  -- A fixed list, so the shop can see "damaged" three times in a month and
  -- know it is the courier, not three unrelated complaints.
  reason        text not null check (reason in (
                  'damaged', 'wrong_item', 'not_as_described',
                  'size_fit', 'changed_mind', 'other'
                )),
  -- In the customer's words. Never edited by the shop.
  note          text not null default '',
  -- The shop's reply, shown to the customer.
  staff_note    text not null default '',
  refund_paise  bigint check (refund_paise is null or refund_paise >= 0),
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references auth.users (id) on delete set null,
  refunded_at   timestamptz
);

create index return_requests_order_idx on public.return_requests (order_id);
create index return_requests_status_idx
  on public.return_requests (status, requested_at desc);

create table public.return_request_items (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.return_requests (id) on delete cascade,
  order_item_id  uuid not null references public.order_items (id) on delete cascade,
  quantity       integer not null check (quantity > 0),
  unique (request_id, order_item_id)
);

-- ============================================================================
-- RLS: read your own, staff read all, nobody writes directly.
-- ============================================================================

alter table public.return_requests      enable row level security;
alter table public.return_request_items enable row level security;

create policy return_requests_owner_read on public.return_requests
  for select to authenticated
  using (customer_id = (select auth.uid()));

create policy return_requests_staff_read on public.return_requests
  for select to authenticated
  using (public.has_admin_role(array['order_manager', 'support']::public.admin_role[]));

create policy return_items_owner_read on public.return_request_items
  for select to authenticated
  using (exists (
    select 1 from public.return_requests r
    where r.id = request_id and r.customer_id = (select auth.uid())
  ));

create policy return_items_staff_read on public.return_request_items
  for select to authenticated
  using (public.has_admin_role(array['order_manager', 'support']::public.admin_role[]));

-- No insert, update or delete policy for anyone. The functions below are the
-- only way in, and they run as definer.
revoke insert, update, delete on public.return_requests      from anon, authenticated;
revoke insert, update, delete on public.return_request_items from anon, authenticated;

-- ============================================================================
-- request_return — the customer asks.
--
-- Everything the help panel promised is checked here, where the browser cannot
-- argue with it: their own order, delivered, inside the window, pieces that
-- are actually on the order, in quantities that were actually bought.
-- ============================================================================

create or replace function public.request_return(
  p_order_id uuid,
  p_items    jsonb,
  p_reason   text,
  p_note     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer   uuid := (select auth.uid());
  v_order      public.orders%rowtype;
  v_delivered  timestamptz;
  v_window     integer;
  v_request    uuid;
  v_reason     text;
  v_count      integer := 0;
  item         record;
  v_line       public.order_items%rowtype;
begin
  if v_customer is null then
    raise exception 'Sign in to ask for a return.';
  end if;

  v_reason := lower(btrim(coalesce(p_reason, '')));
  if v_reason not in ('damaged', 'wrong_item', 'not_as_described',
                      'size_fit', 'changed_mind', 'other') then
    raise exception 'Choose a reason for the return.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Choose at least one piece to return.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  -- Not theirs reads the same as not there. Telling the difference would
  -- answer a question about somebody else's order.
  if not found or v_order.customer_id is distinct from v_customer then
    raise exception 'That order could not be found.';
  end if;

  if v_order.status <> 'delivered' then
    raise exception 'A return can be asked for once the order has been delivered.';
  end if;

  if exists (
    select 1 from public.return_requests
    where order_id = p_order_id and status in ('requested', 'approved')
  ) then
    raise exception 'There is already a return open on this order. We will be in touch about it.';
  end if;

  -- When it arrived. The shipment's own date if the shop recorded one;
  -- otherwise the order's last change, which for a delivered order is the
  -- moment it was marked delivered. An approximation, and the generous one.
  select coalesce(
           (select s.delivered_at from public.shipments s
             where s.order_id = p_order_id and s.delivered_at is not null
             order by s.delivered_at desc limit 1),
           v_order.updated_at
         )
    into v_delivered;

  select coalesce(s.return_window_days, 7) into v_window
  from public.settings s limit 1;
  v_window := coalesce(v_window, 7);

  if v_delivered + make_interval(days => v_window) < now() then
    raise exception
      'The % day return window on this order has closed. Message us and we will see what we can do.',
      v_window;
  end if;

  insert into public.return_requests (order_id, customer_id, reason, note)
  values (
    p_order_id, v_customer, v_reason,
    left(btrim(coalesce(p_note, '')), 1000)
  )
  returning id into v_request;

  for item in
    select (e ->> 'order_item_id')::uuid as order_item_id,
           coalesce((e ->> 'quantity')::integer, 1) as quantity
    from jsonb_array_elements(p_items) as e
  loop
    select * into v_line
    from public.order_items
    where id = item.order_item_id and order_id = p_order_id;

    if not found then
      raise exception 'One of those pieces is not on this order.';
    end if;
    if item.quantity < 1 or item.quantity > v_line.quantity then
      raise exception 'You can return between 1 and % of %.',
        v_line.quantity, v_line.product_name;
    end if;

    insert into public.return_request_items (request_id, order_item_id, quantity)
    values (v_request, item.order_item_id, item.quantity);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('request_id', v_request, 'items', v_count);
end;
$$;

comment on function public.request_return(uuid, jsonb, text, text) is
  'A customer asks to return pieces from their own delivered order, inside the return window. Every rule is checked here.';

revoke execute on function public.request_return(uuid, jsonb, text, text) from public;
grant execute on function public.request_return(uuid, jsonb, text, text) to authenticated;

-- ============================================================================
-- admin_decide_return — the shop answers.
--
--   approve  puts the requested pieces back into stock, and moves the order
--            to `returned` only if every piece on it has now come back.
--   decline  closes the request with a reason the customer can read.
--   refund   records that the money has gone, on an approved request. The
--            money itself moves elsewhere — cash in a hand, or CCAvenue's
--            dashboard — so this writes the fact down and nothing more.
-- ============================================================================

create or replace function public.admin_decide_return(
  p_request_id  uuid,
  p_decision    text,
  p_staff_note  text default null,
  p_refund      bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request   public.return_requests%rowtype;
  v_order     public.orders%rowtype;
  v_decision  text;
  v_restocked integer := 0;
  v_all_back  boolean;
  v_total_ref bigint;
  item        record;
begin
  if not public.has_admin_role(array['order_manager']::public.admin_role[]) then
    raise exception 'You cannot decide returns.';
  end if;

  v_decision := lower(btrim(coalesce(p_decision, '')));
  if v_decision not in ('approve', 'decline', 'refund') then
    raise exception 'A return is approved, declined or refunded.';
  end if;

  select * into v_request
  from public.return_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'That return could not be found.';
  end if;

  select * into v_order
  from public.orders
  where id = v_request.order_id
  for update;

  -- --------------------------------------------------------------------------
  if v_decision = 'approve' then
    if v_request.status <> 'requested' then
      raise exception 'This return has already been %.', v_request.status;
    end if;

    for item in
      select order_item_id, quantity
      from public.return_request_items
      where request_id = p_request_id
    loop
      v_restocked := v_restocked
        + public.restock_order_item(item.order_item_id, item.quantity);
    end loop;

    -- Everything on the order back on the shelf? Then the order itself is
    -- returned. Otherwise it stays delivered and the request carries the state.
    select not exists (
      select 1 from public.order_items
      where order_id = v_order.id and restocked_quantity < quantity
    ) into v_all_back;

    if v_all_back then
      update public.orders set status = 'returned' where id = v_order.id;
    end if;

    update public.return_requests
    set status     = 'approved',
        staff_note = left(btrim(coalesce(p_staff_note, '')), 1000),
        decided_at = now(),
        decided_by = (select auth.uid())
    where id = p_request_id;

    return jsonb_build_object(
      'status', 'approved', 'restocked', v_restocked, 'order_returned', v_all_back
    );
  end if;

  -- --------------------------------------------------------------------------
  if v_decision = 'decline' then
    if v_request.status <> 'requested' then
      raise exception 'This return has already been %.', v_request.status;
    end if;
    if btrim(coalesce(p_staff_note, '')) = '' then
      raise exception 'Say why, in a sentence the customer will read.';
    end if;

    update public.return_requests
    set status     = 'declined',
        staff_note = left(btrim(p_staff_note), 1000),
        decided_at = now(),
        decided_by = (select auth.uid())
    where id = p_request_id;

    return jsonb_build_object('status', 'declined');
  end if;

  -- --------------------------------------------------------------------------
  -- refund
  if v_request.status <> 'approved' then
    raise exception 'Approve the return before recording a refund.';
  end if;
  if p_refund is null or p_refund < 0 then
    raise exception 'Enter the amount refunded, in rupees.';
  end if;
  if p_refund > v_order.total_paise then
    raise exception 'That is more than the order was worth.';
  end if;

  update public.return_requests
  set status       = 'refunded',
      refund_paise = p_refund,
      refunded_at  = now(),
      staff_note   = case when btrim(coalesce(p_staff_note, '')) = ''
                          then staff_note
                          else left(btrim(p_staff_note), 1000) end
  where id = p_request_id;

  -- The payment row keeps a running total, so two partial refunds on one
  -- order add up rather than the second overwriting the first.
  update public.payments
  set refunded_paise = least(amount_paise, refunded_paise + p_refund),
      status = case when refunded_paise + p_refund >= amount_paise
                    then 'refunded'::public.payment_status
                    else 'partially_refunded'::public.payment_status end
  where order_id = v_order.id
  returning refunded_paise into v_total_ref;

  if v_total_ref is not null and v_total_ref >= v_order.total_paise then
    update public.orders set status = 'refunded' where id = v_order.id;
  end if;

  return jsonb_build_object('status', 'refunded', 'refund_paise', p_refund);
end;
$$;

comment on function public.admin_decide_return(uuid, text, text, bigint) is
  'Approves (restocking only the returned pieces), declines, or records the refund on a return. Order managers only.';

revoke execute on function public.admin_decide_return(uuid, text, text, bigint) from public;
grant execute on function public.admin_decide_return(uuid, text, text, bigint) to authenticated;
