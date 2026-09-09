-- ============================================================================
-- Customer testimonials
-- ----------------------------------------------------------------------------
-- What a shopper said, who said it, and where they are. Rows rather than
-- strings in a component, for the same reason every other piece of editorial
-- is a row: a testimonial is business information, and the person who collects
-- it should be able to publish it without a deploy.
--
-- `is_published` defaults to false. A testimonial is a claim about a real
-- person; nothing appears on the storefront until someone deliberately
-- publishes it, and the seed ships none.
-- ============================================================================

create table if not exists public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  author       text not null,
  -- Where they are, shown under the name. Optional: not every review has one.
  location     text not null default '',
  body         text not null,
  -- Out of five. Constrained so a stray value cannot render six stars.
  rating       smallint not null default 5 check (rating between 1 and 5),
  -- The piece they bought, when it is known. Null keeps the quote general,
  -- and a deleted product leaves the quote standing.
  product_id   uuid references public.products (id) on delete set null,
  position     integer not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists testimonials_touch_updated_at on public.testimonials;
create trigger testimonials_touch_updated_at
  before update on public.testimonials
  for each row execute function public.touch_updated_at();

alter table public.testimonials enable row level security;

-- Same shape as the journal: the public sees what is published, staff see
-- everything so an unpublished draft can be found and finished.
drop policy if exists testimonials_public_read on public.testimonials;
create policy testimonials_public_read on public.testimonials
  for select to anon, authenticated using (is_published);

drop policy if exists testimonials_staff_read on public.testimonials;
create policy testimonials_staff_read on public.testimonials
  for select to authenticated using (public.is_admin());

drop policy if exists testimonials_staff_write on public.testimonials;
create policy testimonials_staff_write on public.testimonials
  for all to authenticated
  using (public.has_admin_role(array['content_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['content_manager']::public.admin_role[]));

comment on table public.testimonials is
  'Customer reviews shown on the homepage. Unpublished by default: a quote is a claim about a real person, so it is published deliberately, never seeded.';

-- ----------------------------------------------------------------------------
-- The section key. Postgres allows a new enum value inside a transaction but
-- forbids *using* it in that same transaction, so the homepage row that uses
-- it is a separate migration.
-- ----------------------------------------------------------------------------

alter type public.homepage_section_key add value if not exists 'testimonials';
