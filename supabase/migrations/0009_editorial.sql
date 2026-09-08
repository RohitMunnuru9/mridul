-- ============================================================================
-- 0009 — The last of the hardcoded content, and one figure that had two homes.
--
-- Two problems this closes.
--
-- First: a handful of editorial strings were still written into components —
-- the blouse size chart, the shipping and returns copy, the footer quote, the
-- header strapline. None of it is product data, but by the project's own rule
-- none of it should need a deploy to change either. A size chart in particular
-- is a customer-facing promise about fit.
--
-- Second, and more seriously: the free-shipping threshold existed in two
-- places. `settings.free_shipping_threshold_paise` here, and a constant in the
-- shipping package that the bag meter and the delivery check actually read.
-- They agreed at ₹1,999, so nothing looked wrong — but changing it in the
-- admin would have moved the announcement bar and left the bag behind. The
-- schema comment claiming "one figure, read everywhere" was not true. This
-- migration and the accompanying code change make it true.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Size charts, per category
--
-- On the category rather than in its own table: a chart describes how a
-- category is cut, sarees do not have one, and an empty array is a perfectly
-- good way to say so.
--
-- Shape: [{ "size": "M", "bust": "36", "waist": "30", "shoulder": "14" }, ...]
-- ----------------------------------------------------------------------------

alter table public.categories
  add column if not exists size_chart jsonb not null default '[]'::jsonb;

alter table public.categories
  add column if not exists size_chart_note text not null default '';

comment on column public.categories.size_chart is
  'Garment measurements in inches. Empty for categories that are not sized.';

-- ----------------------------------------------------------------------------
-- Policy links
--
-- Previously a hardcoded list in the data layer. As a column the footer can
-- start linking them the moment the pages exist, without a code change.
-- ----------------------------------------------------------------------------

alter table public.settings
  add column if not exists pending_policies text[] not null default '{}';

-- ----------------------------------------------------------------------------
-- Editorial blocks
--
-- Small named pieces of prose that belong to no product and no page in
-- particular. Keyed by a stable slug the components look up, so adding a block
-- is a row and rewording one is an edit.
-- ----------------------------------------------------------------------------

create table if not exists public.content_blocks (
  key        text primary key,
  title      text not null default '',
  body       text not null,
  -- Where it appears, purely so the admin can group them sensibly.
  placement  text not null default 'general',
  is_active  boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger content_blocks_touch
  before update on public.content_blocks
  for each row execute function public.touch_updated_at();

alter table public.content_blocks enable row level security;

create policy content_blocks_public_read on public.content_blocks
  for select to anon, authenticated
  using (is_active);

create policy content_blocks_staff_read on public.content_blocks
  for select to authenticated
  using (public.is_admin());

create policy content_blocks_staff_write on public.content_blocks
  for all to authenticated
  using (public.has_admin_role(array['content_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['content_manager']::public.admin_role[]));
