-- ============================================================================
-- 0008 — Storage buckets and their policies.
--
-- Product photography is public by nature: it is served to every shopper and
-- there is nothing to protect. So the buckets are public for reads, and the
-- entire security question is who may write.
--
-- Storage policies live on `storage.objects` and follow the same role model as
-- the rest of the schema. Note that this file must run with enough privilege
-- to write to the storage schema — it does in the Supabase SQL editor and via
-- `supabase db push`.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('products',    'products',    true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('collections', 'collections', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('banners',     'banners',     true, 15728640,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('homepage',    'homepage',    true, 15728640,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('media',       'media',       true, 20971520,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif',
         'video/mp4', 'application/pdf'])
on conflict (id) do nothing;

-- The 10-20MB ceilings and the mime allow-list are the real controls here.
-- Without them a bucket that is public for reads is also an open file host.

-- ----------------------------------------------------------------------------
-- Read: anyone, for every storefront bucket.
-- ----------------------------------------------------------------------------

create policy "storefront media is publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id in ('products', 'collections', 'banners', 'homepage', 'media')
  );

-- ----------------------------------------------------------------------------
-- Write: split by role, matching who owns each kind of image.
--
-- A catalogue manager uploads product photography. A content manager uploads
-- banners and editorial. Neither can quietly replace the other's files.
-- ----------------------------------------------------------------------------

create policy "catalogue staff manage product imagery"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id in ('products', 'collections')
    and public.has_admin_role(array['catalog_manager']::public.admin_role[])
  )
  with check (
    bucket_id in ('products', 'collections')
    and public.has_admin_role(array['catalog_manager']::public.admin_role[])
  );

create policy "content staff manage banners and editorial"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id in ('banners', 'homepage', 'media')
    and public.has_admin_role(array['content_manager']::public.admin_role[])
  )
  with check (
    bucket_id in ('banners', 'homepage', 'media')
    and public.has_admin_role(array['content_manager']::public.admin_role[])
  );
