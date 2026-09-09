-- ============================================================================
-- The testimonials homepage row
-- ----------------------------------------------------------------------------
-- Separate from 0012 because Postgres forbids using an enum value in the same
-- transaction that adds it.
--
-- It sits at position 6, between the brand story and the journal, and is
-- enabled: the section renders a rating summary drawn from real product data
-- when no testimonial has been published, so an empty table still shows
-- something true rather than a gap.
-- ============================================================================

insert into public.homepage_sections (key, name, description, position, is_enabled)
values (
  'testimonials',
  'Customer reviews',
  'What shoppers said, above the journal.',
  6,
  true
)
on conflict (key) do nothing;

-- Push the journal below it without disturbing anything above.
update public.homepage_sections set position = 7 where key = 'journal';
