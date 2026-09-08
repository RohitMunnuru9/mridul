-- ============================================================================
-- 0003 — Catalogue: categories, collections, products, variants, inventory.
--
-- Money is a bigint count of paise everywhere. Never a float, never a string.
-- Razorpay charges in paise, and integer arithmetic keeps totals exact.
--
-- Stock lives on `inventory`, one row per variant, because a saree can be sold
-- out with its blouse piece and still available on its own. Rolling it up to
-- the product would lose exactly the distinction the storefront needs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Categories — the storefront navigation
-- ----------------------------------------------------------------------------

create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  tagline       text not null default '',
  intro         text not null default '',
  description   text not null default '',
  hero_media_id uuid references public.media (id) on delete set null,
  -- Self-reference allows a future sub-category tier (Sarees > Silk) without
  -- a migration. Null means top level, which is all the nav renders today.
  parent_id     uuid references public.categories (id) on delete set null,
  position      integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger categories_touch
  before update on public.categories
  for each row execute function public.touch_updated_at();

create index categories_parent_idx on public.categories (parent_id);
create index categories_active_position_idx
  on public.categories (is_active, position);

-- ----------------------------------------------------------------------------
-- Collections — edits that cut across categories
-- ----------------------------------------------------------------------------

create table public.collections (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  tagline    text not null default '',
  is_active  boolean not null default true,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger collections_touch
  before update on public.collections
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Products
-- ----------------------------------------------------------------------------

create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  subtitle            text not null default '',
  description         text not null default '',
  -- Nullable because blouses have no blouse piece to describe.
  blouse_details      text,
  care                text[] not null default '{}',

  -- The category used for breadcrumbs and the header nav. Additional taxonomy
  -- goes through product_categories.
  primary_category_id uuid references public.categories (id) on delete restrict,

  price_paise         bigint not null check (price_paise >= 0),
  -- The struck-through "was" price. Must actually be higher, or it is a lie.
  compare_at_paise    bigint check (compare_at_paise is null
                                    or compare_at_paise > price_paise),

  badge               public.product_badge,
  fabric              text not null default '',
  colour_name         text not null default '',
  colour_hex          text not null default '#000000'
                        check (colour_hex ~* '^#[0-9a-f]{6}$'),
  swatches            text[] not null default '{}',
  occasion            text not null default '',
  technique           text not null default '',

  -- Denormalised from reviews once those exist. Kept here so listing queries
  -- do not aggregate on every page load.
  rating_average      numeric(2, 1) check (rating_average between 0 and 5),
  rating_count        integer not null default 0 check (rating_count >= 0),

  is_active           boolean not null default true,
  published_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger products_touch
  before update on public.products
  for each row execute function public.touch_updated_at();

create index products_active_idx on public.products (is_active);
create index products_primary_category_idx
  on public.products (primary_category_id);
create index products_published_idx on public.products (published_at desc);
create index products_fabric_idx on public.products (fabric);
create index products_occasion_idx on public.products (occasion);

-- Trigram index over the fields a shopper actually types into search.
create index products_search_idx on public.products
  using gin ((name || ' ' || subtitle || ' ' || fabric || ' ' ||
              colour_name || ' ' || occasion || ' ' || technique) gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- Product images — ordered, position 0 is the thumbnail
-- ----------------------------------------------------------------------------

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  media_id   uuid not null references public.media (id) on delete restrict,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  -- Deferrable so reordering can swap two positions inside one transaction.
  -- A plain unique constraint would reject the intermediate state.
  constraint product_images_position_unique unique (product_id, position)
    deferrable initially immediate
);

create index product_images_product_idx on public.product_images (product_id);
create index product_images_media_idx on public.product_images (media_id);

-- ----------------------------------------------------------------------------
-- Taxonomy junctions
-- ----------------------------------------------------------------------------

create table public.product_categories (
  product_id  uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (product_id, category_id)
);

create index product_categories_category_idx
  on public.product_categories (category_id);

create table public.product_collections (
  product_id    uuid not null references public.products (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  position      integer not null default 0,
  primary key (product_id, collection_id)
);

create index product_collections_collection_idx
  on public.product_collections (collection_id);

-- ----------------------------------------------------------------------------
-- Variants
-- ----------------------------------------------------------------------------

create table public.product_variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  sku               text not null unique,
  label             text not null,
  -- Added to the product price. Signed, so a variant can also be cheaper.
  price_delta_paise bigint not null default 0,
  position          integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger product_variants_touch
  before update on public.product_variants
  for each row execute function public.touch_updated_at();

create index product_variants_product_idx on public.product_variants (product_id);

-- ----------------------------------------------------------------------------
-- Inventory
--
-- Separate from the variant so stock movements have somewhere to live and so a
-- future warehouse dimension does not need the variant row rewritten.
--
-- `reserved` is unused today: stock moves on verified payment, not when an
-- item enters a bag, because an abandoned bag must never hold inventory. The
-- column exists for a future short reservation during checkout.
-- ----------------------------------------------------------------------------

create table public.inventory (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  on_hand    integer not null default 0 check (on_hand >= 0),
  reserved   integer not null default 0 check (reserved >= 0),
  available  integer generated always as (on_hand - reserved) stored,
  updated_at timestamptz not null default now(),
  constraint inventory_reserved_within_stock check (reserved <= on_hand)
);

create trigger inventory_touch
  before update on public.inventory
  for each row execute function public.touch_updated_at();

create index inventory_available_idx on public.inventory (available);

-- Every variant gets an inventory row automatically, so a join never misses.
create or replace function public.create_inventory_for_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory (variant_id, on_hand)
  values (new.id, 0)
  on conflict (variant_id) do nothing;
  return new;
end;
$$;

create trigger product_variants_inventory
  after insert on public.product_variants
  for each row execute function public.create_inventory_for_variant();

-- ============================================================================
-- RLS
--
-- Shape is the same for every catalogue table: the world reads what is active,
-- catalog_manager reads and writes everything including drafts.
-- ============================================================================

alter table public.categories          enable row level security;
alter table public.collections         enable row level security;
alter table public.products            enable row level security;
alter table public.product_images      enable row level security;
alter table public.product_categories  enable row level security;
alter table public.product_collections enable row level security;
alter table public.product_variants    enable row level security;
alter table public.inventory           enable row level security;

-- Categories
create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active);

create policy categories_staff_read on public.categories
  for select to authenticated
  using (public.has_admin_role(array['catalog_manager', 'content_manager']::public.admin_role[]));

create policy categories_staff_write on public.categories
  for all to authenticated
  using (public.has_admin_role(array['catalog_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['catalog_manager']::public.admin_role[]));

-- Collections
create policy collections_public_read on public.collections
  for select to anon, authenticated using (is_active);

create policy collections_staff_read on public.collections
  for select to authenticated
  using (public.has_admin_role(array['catalog_manager', 'content_manager']::public.admin_role[]));

create policy collections_staff_write on public.collections
  for all to authenticated
  using (public.has_admin_role(array['catalog_manager', 'content_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['catalog_manager', 'content_manager']::public.admin_role[]));

-- Products
create policy products_public_read on public.products
  for select to anon, authenticated using (is_active);

create policy products_staff_read on public.products
  for select to authenticated using (public.is_admin());

create policy products_staff_write on public.products
  for all to authenticated
  using (public.has_admin_role(array['catalog_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['catalog_manager']::public.admin_role[]));

-- Product images. Readable when the parent product is, so a draft product's
-- photography is not browsable before launch.
create policy product_images_public_read on public.product_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.is_active
  ));

create policy product_images_staff_read on public.product_images
  for select to authenticated using (public.is_admin());

create policy product_images_staff_write on public.product_images
  for all to authenticated
  using (public.has_admin_role(array['catalog_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['catalog_manager']::public.admin_role[]));

-- Junctions
create policy product_categories_public_read on public.product_categories
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p where p.id = product_id and p.is_active
  ));

create policy product_categories_staff_write on public.product_categories
  for all to authenticated
  using (public.has_admin_role(array['catalog_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['catalog_manager']::public.admin_role[]));

create policy product_collections_public_read on public.product_collections
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p where p.id = product_id and p.is_active
  ));

create policy product_collections_staff_write on public.product_collections
  for all to authenticated
  using (public.has_admin_role(array['catalog_manager', 'content_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['catalog_manager', 'content_manager']::public.admin_role[]));

-- Variants
create policy product_variants_public_read on public.product_variants
  for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.products p where p.id = product_id and p.is_active
  ));

create policy product_variants_staff_read on public.product_variants
  for select to authenticated using (public.is_admin());

create policy product_variants_staff_write on public.product_variants
  for all to authenticated
  using (public.has_admin_role(array['catalog_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['catalog_manager']::public.admin_role[]));

-- Inventory. Readable so the storefront can disable a sold-out option, but
-- writable only by staff — and in practice moved by the stock function in
-- 0005, never by hand during checkout.
create policy inventory_public_read on public.inventory
  for select to anon, authenticated using (true);

create policy inventory_staff_write on public.inventory
  for all to authenticated
  using (public.has_admin_role(array['catalog_manager']::public.admin_role[]))
  with check (public.has_admin_role(array['catalog_manager']::public.admin_role[]));
