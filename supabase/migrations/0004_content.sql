-- ============================================================================
-- 0004 — Site content: hero banners, homepage sections, journal, settings.
--
-- This is the half of the site that is not a product. It exists as rows so the
-- hero image, the headline over it and the order of the homepage are things a
-- content manager changes, not things a developer deploys.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Hero banners
-- ----------------------------------------------------------------------------

create table public.hero_slides (
  id         uuid primary key default gen_random_uuid(),
  media_id   uuid not null references public.media (id) on delete restrict,
  eyebrow    text not null default '',
  title      text not null,
  note       text not null default '',
  cta_label  text not null default '',
  cta_href   text not null default '/',
  position   integer not null default 0,
  is_active  boolean not null default true,
  -- Optional scheduling, so a festive banner can be queued in advance and
  -- retire itself rather than needing someone to remember.
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hero_slides_window check (ends_at is null or starts_at is null
                                       or ends_at > starts_at)
);

create trigger hero_slides_touch
  before update on public.hero_slides
  for each row execute function public.touch_updated_at();

create index hero_slides_active_idx on public.hero_slides (is_active, position);

-- ----------------------------------------------------------------------------
-- Homepage section order
-- ----------------------------------------------------------------------------

create table public.homepage_sections (
  id             uuid primary key default gen_random_uuid(),
  key            public.homepage_section_key not null unique,
  name           text not null,
  description    text not null default '',
  position       integer not null default 0,
  is_enabled     boolean not null default true,
  -- Which collection feeds the section, where that applies. Means the product
  -- rail is merchandised by collection membership rather than a pinned list.
  collection_id  uuid references public.collections (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger homepage_sections_touch
  before update on public.homepage_sections
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Mood tiles, curated edits, value props, journal
--
-- Four small content lists. Each is separate rather than one polymorphic
-- "blocks" table: they have genuinely different shapes, and a single table
-- with a jsonb payload would push validation into the application.
-- ----------------------------------------------------------------------------

create table public.mood_tiles (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  note       text not null default '',
  -- Resolves against the live listing filters, so a tile cannot dead-end.
  href       text not null,
  icon       text not null default 'sparkles',
  tone       text not null default 'clay',
  position   integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger mood_tiles_touch
  before update on public.mood_tiles
  for each row execute function public.touch_updated_at();

create table public.occasion_panels (
  id         uuid primary key default gen_random_uuid(),
  tone       text not null check (tone in ('visual', 'note', 'impact')),
  eyebrow    text not null default '',
  title      text not null,
  body       text,
  cta_label  text not null default '',
  cta_href   text not null default '/',
  position   integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger occasion_panels_touch
  before update on public.occasion_panels
  for each row execute function public.touch_updated_at();

create table public.value_props (
  id         uuid primary key default gen_random_uuid(),
  icon       text not null check (icon in ('truck', 'returns', 'secure', 'artisans')),
  title      text not null,
  note       text not null default '',
  position   integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger value_props_touch
  before update on public.value_props
  for each row execute function public.touch_updated_at();

create table public.journal_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  excerpt      text not null default '',
  body         text,
  media_id     uuid references public.media (id) on delete set null,
  href         text not null default '/',
  position     integer not null default 0,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger journal_posts_touch
  before update on public.journal_posts
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- The brand story panel. Singleton, guarded by a one-row constraint so nobody
-- has to wonder which of two rows the homepage is showing.
-- ----------------------------------------------------------------------------

create table public.story_panel (
  id         boolean primary key default true check (id),
  eyebrow    text not null default '',
  title      text not null,
  body       text not null default '',
  media_id   uuid references public.media (id) on delete set null,
  -- [{ "value": "14", "label": "craft clusters" }, ...]
  stats      jsonb not null default '[]'::jsonb,
  cta_label  text not null default '',
  cta_href   text not null default '/',
  updated_at timestamptz not null default now()
);

create trigger story_panel_touch
  before update on public.story_panel
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Settings — one row, typed columns rather than a key/value bag so a typo in a
-- key cannot silently disable free shipping.
-- ----------------------------------------------------------------------------

create table public.settings (
  id                            boolean primary key default true check (id),
  brand_name                    text not null default 'Mridul by MR',
  tagline                       text not null default '',
  announcements                 text[] not null default '{}',
  -- The single figure the announcement bar, the bag meter, the delivery check
  -- and the shipping module all read. One place, so they cannot drift.
  free_shipping_threshold_paise bigint not null default 199900
                                  check (free_shipping_threshold_paise >= 0),
  flat_shipping_paise           bigint not null default 9900
                                  check (flat_shipping_paise >= 0),
  return_window_days            integer not null default 7
                                  check (return_window_days >= 0),
  whatsapp_number               text not null default '',
  contact_email                 text not null default '',
  instagram_url                 text not null default '',
  youtube_url                   text not null default '',
  updated_at                    timestamptz not null default now()
);

create trigger settings_touch
  before update on public.settings
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RLS — content is world-readable when live, writable by content_manager.
-- ============================================================================

alter table public.hero_slides       enable row level security;
alter table public.homepage_sections enable row level security;
alter table public.mood_tiles        enable row level security;
alter table public.occasion_panels   enable row level security;
alter table public.value_props       enable row level security;
alter table public.journal_posts     enable row level security;
alter table public.story_panel       enable row level security;
alter table public.settings          enable row level security;

-- Hero: the scheduling window is enforced in the policy, so an unpublished
-- banner is not merely hidden by the UI — it is unreadable.
create policy hero_slides_public_read on public.hero_slides
  for select to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

create policy hero_slides_staff_read on public.hero_slides
  for select to authenticated using (public.is_admin());

create policy hero_slides_staff_write on public.hero_slides
  for all to authenticated
  using (public.has_admin_role(array['content_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['content_manager']::public.admin_role[]));

create policy homepage_sections_public_read on public.homepage_sections
  for select to anon, authenticated using (is_enabled);

create policy homepage_sections_staff_read on public.homepage_sections
  for select to authenticated using (public.is_admin());

create policy homepage_sections_staff_write on public.homepage_sections
  for all to authenticated
  using (public.has_admin_role(array['content_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['content_manager']::public.admin_role[]));

create policy mood_tiles_public_read on public.mood_tiles
  for select to anon, authenticated using (is_active);

create policy mood_tiles_staff_write on public.mood_tiles
  for all to authenticated
  using (public.has_admin_role(array['content_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['content_manager']::public.admin_role[]));

create policy occasion_panels_public_read on public.occasion_panels
  for select to anon, authenticated using (is_active);

create policy occasion_panels_staff_write on public.occasion_panels
  for all to authenticated
  using (public.has_admin_role(array['content_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['content_manager']::public.admin_role[]));

create policy value_props_public_read on public.value_props
  for select to anon, authenticated using (is_active);

create policy value_props_staff_write on public.value_props
  for all to authenticated
  using (public.has_admin_role(array['content_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['content_manager']::public.admin_role[]));

create policy journal_posts_public_read on public.journal_posts
  for select to anon, authenticated using (is_published);

create policy journal_posts_staff_read on public.journal_posts
  for select to authenticated using (public.is_admin());

create policy journal_posts_staff_write on public.journal_posts
  for all to authenticated
  using (public.has_admin_role(array['content_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['content_manager']::public.admin_role[]));

create policy story_panel_public_read on public.story_panel
  for select to anon, authenticated using (true);

create policy story_panel_staff_write on public.story_panel
  for all to authenticated
  using (public.has_admin_role(array['content_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['content_manager']::public.admin_role[]));

-- Settings is world-readable because the storefront renders the threshold and
-- the WhatsApp number on every page. Nothing secret belongs in this table —
-- API keys live in environment variables, never here.
create policy settings_public_read on public.settings
  for select to anon, authenticated using (true);

create policy settings_super_write on public.settings
  for all to authenticated
  using (public.has_admin_role(array['super_admin']::public.admin_role[]))
  with check (public.has_admin_role(array['super_admin']::public.admin_role[]));
