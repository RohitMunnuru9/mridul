-- ============================================================================
-- 0007 — Operations: notifications, webhooks, audit log, shipping rules,
--        and the media_usage view the admin library reads.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Outbound notifications (WhatsApp to begin with)
--
-- A row per attempt, so a customer who says "I never got the tracking link"
-- can be answered from the database rather than from memory. A failed send
-- must never fail the order it describes, hence status rather than an
-- exception.
-- ----------------------------------------------------------------------------

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid references public.orders (id) on delete cascade,
  customer_id   uuid references auth.users (id) on delete set null,
  channel       text not null default 'whatsapp',
  event         text not null,
  template      text not null,
  recipient     text not null,
  variables     jsonb not null default '[]'::jsonb,
  status        text not null default 'pending'
                  check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error         text,
  attempts      integer not null default 0,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger notifications_touch
  before update on public.notifications
  for each row execute function public.touch_updated_at();

create index notifications_order_idx on public.notifications (order_id);
create index notifications_status_idx on public.notifications (status)
  where status <> 'sent';

-- ----------------------------------------------------------------------------
-- Webhook events
--
-- Razorpay and the courier both retry, and both may deliver out of order. The
-- unique constraint on the provider's own event id is what makes processing
-- idempotent: a replay hits a conflict and is dropped rather than confirming
-- an order twice.
-- ----------------------------------------------------------------------------

create table public.webhook_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  provider_event_id text not null,
  event_type        text not null,
  payload           jsonb not null,
  -- Whether the signature on the raw body verified. An unverified webhook is
  -- stored for forensics and never acted upon.
  signature_valid   boolean not null default false,
  processed_at      timestamptz,
  error             text,
  received_at       timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index webhook_events_unprocessed_idx
  on public.webhook_events (provider, received_at)
  where processed_at is null;

-- ----------------------------------------------------------------------------
-- Admin audit log
-- ----------------------------------------------------------------------------

create table public.admin_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  actor_email text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index admin_audit_logs_entity_idx
  on public.admin_audit_logs (entity, entity_id);
create index admin_audit_logs_actor_idx
  on public.admin_audit_logs (actor_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Shipping rules
--
-- Interim table for the flat-rate and free-shipping logic, and the place a
-- pincode-based rate card lands once a courier is chosen. Ordered by priority
-- so a specific rule can beat the catch-all.
-- ----------------------------------------------------------------------------

create table public.shipping_rules (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  -- Null matches any pincode. Otherwise a prefix, e.g. '56' for Bengaluru.
  pincode_prefix     text check (pincode_prefix ~ '^[1-9][0-9]*$'),
  min_subtotal_paise bigint not null default 0 check (min_subtotal_paise >= 0),
  max_subtotal_paise bigint check (max_subtotal_paise > min_subtotal_paise),
  rate_paise         bigint not null default 0 check (rate_paise >= 0),
  cod_available      boolean not null default true,
  estimated_days_min integer check (estimated_days_min > 0),
  estimated_days_max integer check (estimated_days_max >= estimated_days_min),
  priority           integer not null default 0,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger shipping_rules_touch
  before update on public.shipping_rules
  for each row execute function public.touch_updated_at();

create index shipping_rules_lookup_idx
  on public.shipping_rules (is_active, priority desc);

-- ============================================================================
-- media_usage — every reference to every file, as a view
--
-- This is the query behind the admin media library. Because it is a view over
-- the real foreign keys, "where is this image used?" cannot drift out of date
-- the way a hand-maintained list would.
-- ============================================================================

create or replace view public.media_usage as
  select
    m.id            as media_id,
    m.bucket,
    m.path,
    m.alt,
    m.focal,
    'Product'::text as kind,
    p.name          as label,
    '/product/' || p.slug as href
  from public.media m
  join public.product_images pi on pi.media_id = m.id
  join public.products p on p.id = pi.product_id

  union all

  select
    m.id, m.bucket, m.path, m.alt, m.focal,
    'Category'::text,
    c.name || ' header',
    '/shop/' || c.slug
  from public.media m
  join public.categories c on c.hero_media_id = m.id

  union all

  select
    m.id, m.bucket, m.path, m.alt, m.focal,
    'Hero slide'::text,
    h.title,
    '/'::text
  from public.media m
  join public.hero_slides h on h.media_id = m.id

  union all

  select
    m.id, m.bucket, m.path, m.alt, m.focal,
    'Journal'::text,
    j.title,
    j.href
  from public.media m
  join public.journal_posts j on j.media_id = m.id

  union all

  select
    m.id, m.bucket, m.path, m.alt, m.focal,
    'Story'::text,
    s.title,
    '/'::text
  from public.media m
  join public.story_panel s on s.media_id = m.id;

comment on view public.media_usage is
  'One row per reference to a media file. Check this before replacing or deleting an asset.';

-- Views run with the privileges of the querying user in Postgres 15+ when
-- declared security_invoker, so the underlying RLS still applies rather than
-- the view becoming a way around it.
alter view public.media_usage set (security_invoker = true);

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.notifications     enable row level security;
alter table public.webhook_events    enable row level security;
alter table public.admin_audit_logs  enable row level security;
alter table public.shipping_rules    enable row level security;

-- Notifications: a customer may see what was sent to them about their order.
create policy notifications_owner_read on public.notifications
  for select to authenticated
  using (customer_id = (select auth.uid()));

create policy notifications_staff_read on public.notifications
  for select to authenticated
  using (public.has_admin_role(
    array['order_manager', 'support']::public.admin_role[]
  ));

-- Webhook events are raw provider payloads: staff-visible, never customer
-- visible, and only ever written by the server.
create policy webhook_events_super_read on public.webhook_events
  for select to authenticated
  using (public.has_admin_role(array['super_admin']::public.admin_role[]));

-- Audit log is append-only from the application's point of view: there is no
-- update or delete policy at all, for anyone. A log an admin can rewrite is
-- not a log.
create policy admin_audit_logs_super_read on public.admin_audit_logs
  for select to authenticated
  using (public.has_admin_role(array['super_admin']::public.admin_role[]));

create policy shipping_rules_public_read on public.shipping_rules
  for select to anon, authenticated
  using (is_active);

create policy shipping_rules_super_write on public.shipping_rules
  for all to authenticated
  using (public.has_admin_role(array['super_admin']::public.admin_role[]))
  with check (public.has_admin_role(array['super_admin']::public.admin_role[]));
