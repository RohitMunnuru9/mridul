-- ============================================================================
-- 0023 — Writing the audit log that 0007 built and nothing ever filled.
--
-- `admin_audit_logs` has existed since 0007, with a comment saying the log is
-- append-only because "a log an admin can rewrite is not a log". It is
-- consistent about that: there is no update policy and no delete policy, for
-- anybody, including a super admin.
--
-- It is also empty, and always has been, because there is no INSERT policy
-- either. Nothing could write to it. The shop now has a screen showing who can
-- get in; the obvious next question — what have they been doing — had no
-- answer at all.
--
-- ---------------------------------------------------------------------------
-- The one thing this function must get right
--
-- WHO DID IT IS NOT AN ARGUMENT. `actor_id` and `actor_email` are read from
-- the session inside the function. A caller cannot pass them, cannot spoof
-- them, and cannot write an entry attributing their own action to somebody
-- else — which is the first thing anybody would try if the log ever mattered.
--
-- Everything else is the caller's word, and that is fine: `action`, `entity`
-- and the before/after pictures describe what the code believes it did. The
-- log's value is in the actor, the time and the sequence, and those three are
-- the ones it does not take on trust.
--
-- Still no update or delete path. Not for this function, not for anyone.
-- ============================================================================

create or replace function public.record_admin_action(
  p_action    text,
  p_entity    text,
  p_entity_id text default null,
  p_before    jsonb default null,
  p_after     jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_email text;
begin
  -- Only somebody who can already administer something may write an entry, so
  -- the log cannot be filled with noise by an ordinary signed-in customer.
  if not public.is_admin() then
    raise exception 'Only an administrator can be recorded in the audit log.';
  end if;

  if p_action is null or btrim(p_action) = ''
     or p_entity is null or btrim(p_entity) = '' then
    raise exception 'An audit entry needs an action and an entity.';
  end if;

  select u.email::text into v_email from auth.users u where u.id = v_actor;

  insert into public.admin_audit_logs (
    actor_id, actor_email, action, entity, entity_id, before, after
  )
  values (
    v_actor,
    v_email,
    left(btrim(p_action), 60),
    left(btrim(p_entity), 60),
    left(coalesce(p_entity_id, ''), 100),
    p_before,
    p_after
  );
end;
$$;

comment on function public.record_admin_action(text, text, text, jsonb, jsonb) is
  'Appends one entry to the audit log. The actor is taken from the session, never from the caller. Administrators only.';

revoke execute on function public.record_admin_action(text, text, text, jsonb, jsonb)
  from public;
grant execute on function public.record_admin_action(text, text, text, jsonb, jsonb)
  to authenticated;

-- ----------------------------------------------------------------------------
-- Reading it back.
--
-- `admin_audit_logs_super_read` in 0007 already restricts this to a super
-- admin, so the page could select the table directly. It goes through a
-- function for one reason: `actor_email` is a snapshot taken when the entry
-- was written, and an account since renamed or deleted would otherwise show
-- nothing at all. Falling back to the id at least says "somebody", which is
-- what a log is for.
-- ----------------------------------------------------------------------------

create or replace function public.admin_audit_trail(
  p_limit  integer default 100,
  p_entity text default null
)
returns table (
  id          uuid,
  actor_email text,
  action      text,
  entity      text,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id,
         coalesce(nullif(l.actor_email, ''), 'account ' || left(l.actor_id::text, 8)),
         l.action,
         l.entity,
         l.entity_id,
         l.before,
         l.after,
         l.created_at
  from public.admin_audit_logs l
  where public.has_admin_role(array['super_admin']::public.admin_role[])
    and (p_entity is null or l.entity = p_entity)
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

comment on function public.admin_audit_trail(integer, text) is
  'The most recent audit entries, newest first. Super admins only.';

revoke execute on function public.admin_audit_trail(integer, text) from public;
grant execute on function public.admin_audit_trail(integer, text) to authenticated;
