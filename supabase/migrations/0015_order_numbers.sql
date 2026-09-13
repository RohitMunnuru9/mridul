-- ============================================================================
-- Order numbers
-- ----------------------------------------------------------------------------
-- `orders.order_number` is `not null unique` and nothing generated it, so no
-- order could be written at all.
--
-- A sequence rather than `count(*) + 1`: two people checking out in the same
-- moment would both read the same count and one insert would fail on the
-- unique constraint. nextval is atomic and never hands the same value twice,
-- even inside concurrent transactions.
--
-- The number is deliberately not the primary key. It is printed on invoices
-- and read out over the phone, so it wants to be short and human; the id stays
-- a uuid so it is not guessable from someone else's order number.
-- ============================================================================

create sequence if not exists public.order_number_seq start with 1;

create or replace function public.next_order_number()
returns text
language sql
volatile
as $$
  -- MR-2026-000148. The year is the calendar year at the moment of issue;
  -- the counter does not reset, so a number is unique for the life of the shop
  -- rather than only within its year.
  select 'MR-'
      || to_char(now() at time zone 'Asia/Kolkata', 'YYYY')
      || '-'
      || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

comment on function public.next_order_number() is
  'Issues the next human-facing order reference. Atomic: safe for concurrent checkouts.';

-- The storefront calls this as the signed-in customer while placing an order.
grant usage, select on sequence public.order_number_seq to authenticated;
grant execute on function public.next_order_number() to authenticated;
