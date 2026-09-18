-- ============================================================================
-- 0019 — Saving stock without erasing a sale.
--
-- The problem this fixes, concretely:
--
--   1. The shop opens the stock page. Noor Ivory shows 3.
--   2. A customer buys one. `place_order` takes the row lock and writes 2.
--   3. The shop, still looking at a page that says 3, types 4 and saves.
--
-- The old write was `update inventory set on_hand = 4`, unconditional. Step 3
-- silently undid step 2: the sale is gone from inventory, the shop believes it
-- has four, and it has three. Every such collision loses a piece, quietly, and
-- the only symptom is an oversell weeks later.
--
-- Nothing was wrong with the *order* side — `place_order` locks the row and
-- always has. The hole was that the admin wrote over it without looking.
--
-- The fix is compare-and-set. The form already knows what it displayed, so it
-- sends that back; this function refuses the write if the shelf has moved
-- since, and says what it moved to. An admin who is told "it was 3 when you
-- opened this, it is 2 now — a sale went through" can decide what they meant.
-- Silently winning that race is the one outcome with no recovery.
--
-- Two details that matter:
--
--   ALL OR NOTHING. A stock sheet with six options saves completely or not at
--   all. The previous code looped, updating one row per round trip, so a
--   failure halfway left some options saved and some not, with nothing to say
--   which. Here the conflicts are gathered first and the writes happen only if
--   there are none — and it is one transaction, so an error at the end undoes
--   the beginning.
--
--   LOCKS TAKEN IN A FIXED ORDER. Two people saving overlapping sets of
--   options at the same moment would otherwise be able to take each other's
--   rows in opposite orders and deadlock. Ordering by variant id means
--   everybody queues the same way.
-- ============================================================================

create or replace function public.admin_set_stock(p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conflicts jsonb := '[]'::jsonb;
  v_changed   integer := 0;
  v_actual    integer;
  v_label     text;
  item        record;
begin
  if not public.has_admin_role(array['catalog_manager']::public.admin_role[]) then
    raise exception 'You cannot change stock.';
  end if;

  if p_changes is null
     or jsonb_typeof(p_changes) <> 'array'
     or jsonb_array_length(p_changes) = 0 then
    raise exception 'Nothing to save.';
  end if;

  if jsonb_array_length(p_changes) > 100 then
    raise exception 'Too many options in one save.';
  end if;

  -- ------------------------------------------------------------------------
  -- First pass: lock every row and find out whether anything has moved.
  --
  -- The lock is held from here to the end of the transaction, so a sale that
  -- arrives between this check and the writes below queues behind it rather
  -- than slipping in between them.
  -- ------------------------------------------------------------------------
  for item in
    select (e ->> 'variant_id')::uuid as variant_id,
           (e ->> 'on_hand')::integer as on_hand,
           case when e ->> 'expected' is null then null
                else (e ->> 'expected')::integer end as expected
    from jsonb_array_elements(p_changes) as e
    order by 1
  loop
    if item.variant_id is null then
      raise exception 'That product option could not be identified.';
    end if;
    if item.on_hand is null or item.on_hand < 0 then
      raise exception 'Stock must be a whole number, zero or more.';
    end if;

    select i.on_hand into v_actual
    from public.inventory i
    where i.variant_id = item.variant_id
    for update;

    if not found then
      raise exception 'Stock has not been set up for one of these options.';
    end if;

    -- `expected` null means the caller had nothing on screen to compare with,
    -- so there is no race to detect and the write stands.
    if item.expected is not null and v_actual <> item.expected then
      select p.name || ' · ' || v.label into v_label
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = item.variant_id;

      v_conflicts := v_conflicts || jsonb_build_object(
        'variant_id', item.variant_id,
        'label',      coalesce(v_label, 'This option'),
        'expected',   item.expected,
        'actual',     v_actual
      );
    end if;
  end loop;

  -- Something moved. Change nothing and hand back what it moved to.
  if jsonb_array_length(v_conflicts) > 0 then
    return jsonb_build_object('ok', false, 'conflicts', v_conflicts);
  end if;

  -- ------------------------------------------------------------------------
  -- Second pass: the writes. Every row involved is already locked.
  -- ------------------------------------------------------------------------
  for item in
    select (e ->> 'variant_id')::uuid as variant_id,
           (e ->> 'on_hand')::integer as on_hand
    from jsonb_array_elements(p_changes) as e
    order by 1
  loop
    update public.inventory
    set on_hand = item.on_hand
    where variant_id = item.variant_id
      and on_hand is distinct from item.on_hand;

    if found then
      v_changed := v_changed + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'changed', v_changed, 'conflicts', '[]'::jsonb);
end;
$$;

comment on function public.admin_set_stock(jsonb) is
  'Sets stock for one or more variants, all or nothing, refusing to overwrite a count that has changed since the caller read it. Catalog managers only.';

revoke execute on function public.admin_set_stock(jsonb) from public;
grant execute on function public.admin_set_stock(jsonb) to authenticated;
