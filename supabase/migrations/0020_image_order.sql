-- ============================================================================
-- 0020 — Ordering product photographs without standing on each other's feet.
--
-- Every reorder was a sequence of separate round trips with no transaction
-- around them, and the intermediate states were visible to everybody.
--
-- The worst of it was the parking slot. `position` is unique per product, so
-- to swap two rows the old code moved one to -1, moved the other into the
-- vacated slot, then brought the first back. If anything failed in between —
-- a dropped connection, a closed laptop, a second editor arriving mid-shuffle
-- — a row stayed at -1. And -1 sorts BEFORE 0, so an interrupted reorder
-- silently changed which photograph the storefront shows as the thumbnail.
-- Nobody would connect the two.
--
-- None of that parking is necessary. 0003 declared the constraint
--
--     unique (product_id, position) deferrable initially immediate
--
-- with a comment saying it was deferrable so that reordering could swap two
-- positions inside one transaction. Nothing ever took it up on that. These
-- functions do: they defer the constraint, renumber the whole product in one
-- statement, and let the check happen at commit. There is no intermediate
-- state for anyone to see, and no slot to get stranded in.
--
-- Concurrency: each function locks that product's image rows before touching
-- anything, so two people reordering the same product queue rather than
-- interleave. Two people working on different products never meet.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Renumber one product's images to 0..n-1, in a given order.
--
-- `p_first` is the image that should end up at 0, or null to keep the current
-- order and merely close any gaps. Everything else holds its relative place.
--
-- Not granted to anybody: it is the shared middle of the four functions below,
-- each of which has already checked the caller's role.
-- ----------------------------------------------------------------------------
create or replace function public.renumber_product_images(
  p_product_id uuid,
  p_first      uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The whole point. Without this the single UPDATE below would trip over its
  -- own intermediate rows, because two images momentarily share a position.
  set constraints public.product_images_position_unique deferred;

  update public.product_images pi
  set position = ordered.rank
  from (
    select id,
           (row_number() over (
              order by case when media_id = p_first then 0 else 1 end,
                       position,
                       created_at
            ) - 1)::integer as rank
    from public.product_images
    where product_id = p_product_id
  ) as ordered
  where pi.id = ordered.id
    and pi.position is distinct from ordered.rank;
end;
$$;

revoke execute on function public.renumber_product_images(uuid, uuid) from public;

-- ----------------------------------------------------------------------------
-- Lock one product's images. Returns how many there are.
--
-- Called first by everything below, so that two editors on the same product
-- take turns instead of reading the same order and both acting on it.
-- ----------------------------------------------------------------------------
create or replace function public.lock_product_images(p_product_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from (
    select 1
    from public.product_images
    where product_id = p_product_id
    order by position
    for update
  ) as locked;

  return v_count;
end;
$$;

revoke execute on function public.lock_product_images(uuid) from public;

-- ============================================================================
-- Add
--
-- The old code counted the rows and inserted at that number. Two uploads
-- landing together both read the same count and both tried to insert at it —
-- one of them failed on the unique constraint, after its file had already been
-- written to the bucket.
-- ============================================================================
create or replace function public.admin_add_product_image(
  p_product_id uuid,
  p_media_id   uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_position integer;
begin
  if not public.has_admin_role(array['catalog_manager']::public.admin_role[]) then
    raise exception 'You cannot edit product images.';
  end if;

  perform public.lock_product_images(p_product_id);

  -- Read under the lock taken above, so it cannot be stale by the time it is
  -- used one line later.
  select coalesce(max(position) + 1, 0) into v_position
  from public.product_images
  where product_id = p_product_id;

  insert into public.product_images (product_id, media_id, position)
  values (p_product_id, p_media_id, v_position);

  return v_position;
end;
$$;

comment on function public.admin_add_product_image(uuid, uuid) is
  'Appends an image to a product at the next free position, under a lock. Catalog managers only.';

revoke execute on function public.admin_add_product_image(uuid, uuid) from public;
grant execute on function public.admin_add_product_image(uuid, uuid) to authenticated;

-- ============================================================================
-- Remove
--
-- Deleting left a gap, which the old code closed with one round trip per
-- remaining row. Two removals at once could renumber against each other's
-- half-finished work.
-- ============================================================================
create or replace function public.admin_remove_product_image(
  p_product_id uuid,
  p_media_id   uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role(array['catalog_manager']::public.admin_role[]) then
    raise exception 'You cannot edit product images.';
  end if;

  perform public.lock_product_images(p_product_id);

  delete from public.product_images
  where product_id = p_product_id and media_id = p_media_id;

  -- The file itself stays in the bucket. Removing an image from a product is
  -- not the same decision as destroying the photograph, and the second one is
  -- not reversible.
  perform public.renumber_product_images(p_product_id);
end;
$$;

comment on function public.admin_remove_product_image(uuid, uuid) is
  'Takes an image off a product and closes the gap in one transaction. The file stays in storage. Catalog managers only.';

revoke execute on function public.admin_remove_product_image(uuid, uuid) from public;
grant execute on function public.admin_remove_product_image(uuid, uuid) to authenticated;

-- ============================================================================
-- Make it the thumbnail
-- ============================================================================
create or replace function public.admin_set_product_thumbnail(
  p_product_id uuid,
  p_media_id   uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role(array['catalog_manager']::public.admin_role[]) then
    raise exception 'You cannot reorder product images.';
  end if;

  perform public.lock_product_images(p_product_id);

  if not exists (
    select 1 from public.product_images
    where product_id = p_product_id and media_id = p_media_id
  ) then
    raise exception 'That image is not on this product.';
  end if;

  perform public.renumber_product_images(p_product_id, p_media_id);
end;
$$;

comment on function public.admin_set_product_thumbnail(uuid, uuid) is
  'Moves one image to position 0, everything else keeping its relative order. Catalog managers only.';

revoke execute on function public.admin_set_product_thumbnail(uuid, uuid) from public;
grant execute on function public.admin_set_product_thumbnail(uuid, uuid) to authenticated;

-- ============================================================================
-- Nudge one place
-- ============================================================================
create or replace function public.admin_move_product_image(
  p_product_id uuid,
  p_media_id   uuid,
  p_direction  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_position integer;
  v_target   integer;
  v_other    uuid;
begin
  if not public.has_admin_role(array['catalog_manager']::public.admin_role[]) then
    raise exception 'You cannot reorder product images.';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'Move an image up or down, nothing else.';
  end if;

  perform public.lock_product_images(p_product_id);

  -- Close any gaps first, so "one place" means one place even if an older
  -- interrupted reorder left the numbering ragged.
  perform public.renumber_product_images(p_product_id);

  select position into v_position
  from public.product_images
  where product_id = p_product_id and media_id = p_media_id;

  if not found then
    raise exception 'That image is not on this product.';
  end if;

  v_target := case when p_direction = 'up' then v_position - 1
                   else v_position + 1 end;

  select id into v_other
  from public.product_images
  where product_id = p_product_id and position = v_target;

  if not found then
    raise exception 'That image is already at the edge.';
  end if;

  -- Both rows move in one statement, with the constraint deferred, so there is
  -- never a moment where one of them is parked somewhere invalid.
  set constraints public.product_images_position_unique deferred;

  update public.product_images
  set position = case when media_id = p_media_id then v_target else v_position end
  where product_id = p_product_id
    and (media_id = p_media_id or id = v_other);
end;
$$;

comment on function public.admin_move_product_image(uuid, uuid, text) is
  'Swaps an image with its neighbour in one transaction, with no parking slot to get stranded in. Catalog managers only.';

revoke execute on function public.admin_move_product_image(uuid, uuid, text) from public;
grant execute on function public.admin_move_product_image(uuid, uuid, text) to authenticated;

-- ============================================================================
-- Tidy up anything the old code left behind.
--
-- A row parked at -1 by an interrupted reorder is still sitting there, sorting
-- ahead of position 0 and quietly acting as the thumbnail. Renumbering every
-- product once puts them all back to 0..n-1 in their current visible order,
-- which is what somebody looking at the page would expect either way.
-- ============================================================================
do $$
declare
  v_product uuid;
begin
  for v_product in
    select distinct product_id from public.product_images where position < 0
  loop
    perform public.renumber_product_images(v_product);
  end loop;
end;
$$;
