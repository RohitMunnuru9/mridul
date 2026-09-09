-- ============================================================================
-- A picture on a customer review
-- ----------------------------------------------------------------------------
-- Optional, and null by default: most reviews arrive as words alone, and a
-- card without a picture has to keep working. `on delete set null` so removing
-- the file from the media library leaves the review standing rather than
-- taking a customer's words down with it.
-- ============================================================================

alter table public.testimonials
  add column if not exists media_id uuid references public.media (id) on delete set null;

comment on column public.testimonials.media_id is
  'Optional photograph shown with the review — the customer, or the piece as they wore it.';
