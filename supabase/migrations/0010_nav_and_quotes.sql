-- ============================================================================
-- 0010 — Which collections appear in the nav, and the quotes above the header.
--
-- Two small things, both kept as data rather than as a slice in a component.
--
-- The mobile category strip was rendering every collection, which is fine at
-- five and unreadable at fifteen. Which edits deserve a place in the
-- navigation is a merchandising decision, so it becomes a flag someone can set
-- rather than an array someone has to edit and redeploy.
--
-- The strip above the header carried shipping and returns copy. That
-- information already appears on the value strip, in the bag meter and on the
-- product page, so it earns its place there and not here. This gives the space
-- to something with a bit of voice instead.
-- ============================================================================

alter table public.collections
  add column if not exists show_in_nav boolean not null default false;

comment on column public.collections.show_in_nav is
  'Whether this edit appears in the header navigation. Keep it to a handful.';

alter table public.settings
  add column if not exists quotes text[] not null default '{}';

comment on column public.settings.quotes is
  'Rotated in the strip above the header. Brand voice, not merchandising.';
