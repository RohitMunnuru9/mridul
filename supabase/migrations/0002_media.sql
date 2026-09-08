-- ============================================================================
-- 0002 — Media.
--
-- One row per file, referenced by everything that shows an image. That is what
-- makes "what is this picture doing, and where?" a query instead of a guess —
-- the admin media library reads the `media_usage` view at the bottom of this
-- file rather than walking the catalogue in application code.
--
-- Alt text lives on the asset, not in a component, so it can be corrected
-- without a deploy. It is the most common accessibility fix on a catalogue
-- this size and it should never need an engineer.
-- ============================================================================

create table public.media (
  id          uuid primary key default gen_random_uuid(),
  bucket      public.media_bucket not null,
  -- Path inside the storage bucket, e.g. 'sarees/saanjh-sage-01.jpg'.
  path        text not null,
  alt         text not null default '',
  -- CSS object-position. Lets one upload be cropped differently per use
  -- without generating a second file.
  focal       text not null default '50% 50%',
  width       integer,
  height      integer,
  byte_size   bigint,
  mime_type   text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (bucket, path)
);

create trigger media_touch
  before update on public.media
  for each row execute function public.touch_updated_at();

create index media_bucket_idx on public.media (bucket);

alter table public.media enable row level security;

-- Media is public by nature: these files are served to every shopper.
create policy media_public_read on public.media
  for select to anon, authenticated
  using (true);

create policy media_write_staff on public.media
  for all to authenticated
  using (
    public.has_admin_role(
      array['content_manager', 'catalog_manager']::public.admin_role[]
    )
  )
  with check (
    public.has_admin_role(
      array['content_manager', 'catalog_manager']::public.admin_role[]
    )
  );
