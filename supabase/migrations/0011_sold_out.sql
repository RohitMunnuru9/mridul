-- ============================================================================
-- 0011  Mark a product out of stock without touching its stock
-- ----------------------------------------------------------------------------
-- Three states a product can be in on the storefront:
--
--   live         shown, buyable
--   sold out     shown, blurred, not buyable   <- this migration
--   hidden       not shown at all              (is_active = false, 0003)
--
-- "Sold out" is an editorial decision, separate from the inventory count. A
-- piece can be held back while a photograph is redone or a batch is checked
-- without zeroing 40 units of real stock and typing them back in afterwards.
-- The storefront reads both: a product is buyable only when it has stock AND
-- is not flagged. Restoring the flag restores the numbers as they were.
-- ============================================================================

alter table public.products
  add column if not exists is_sold_out boolean not null default false;

comment on column public.products.is_sold_out is
  'Shown but not buyable. Independent of inventory so the counts survive.';
