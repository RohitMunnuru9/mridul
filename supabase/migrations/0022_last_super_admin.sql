-- ============================================================================
-- 0022 — The shop cannot lock itself out.
--
-- `admin_roles` is about to get a screen, which means the roles that gate
-- everything in this system become a few taps rather than a hand-written
-- insert. That is the point of the screen. It also introduces one mistake that
-- has no recovery from inside the product:
--
--   The last super_admin removes their own super_admin role.
--
-- After that, nobody can grant it back. `admin_roles_write_super` requires
-- super_admin to write to `admin_roles`, and there is no longer one. Every
-- catalogue edit, every order, every discount code is locked behind a door
-- whose only key has been posted through it. The way out is the Supabase SQL
-- editor and a service-role connection, which is exactly the thing a shop
-- owner should never need to be told about at the worst possible moment.
--
-- A check in the admin would stop the obvious version and not the real one:
-- two super admins removing each other at the same moment both pass a check
-- that counts two, and both commit. This is a trigger, holding a lock, so the
-- second one waits and then fails.
--
-- It guards deletes and updates equally. Changing the last super_admin's role
-- to `support` is the same event as deleting it, wearing a different hat.
-- ============================================================================

create or replace function public.keep_one_super_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining integer;
begin
  -- Only super_admin rows can cause a lockout; everything else passes through.
  if old.role <> 'super_admin' then
    return old;
  end if;

  -- An update that leaves the row a super_admin has taken nothing away.
  if tg_op = 'UPDATE' and new.role = 'super_admin' and new.user_id = old.user_id then
    return new;
  end if;

  -- `for update` on the rows being counted: two people removing the last two
  -- super admins at the same moment would otherwise both read 2 and both go
  -- ahead. The second one now waits here and then sees 1.
  select count(*) into v_remaining
  from (
    select 1
    from public.admin_roles
    where role = 'super_admin'
      and not (user_id = old.user_id)
    for update
  ) as others;

  if v_remaining = 0 then
    raise exception
      'This is the shop''s last owner account. Give somebody else owner access first, or you will lock everyone out.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

comment on function public.keep_one_super_admin() is
  'Refuses to remove the final super_admin, which would leave nobody able to grant the role back.';

drop trigger if exists admin_roles_keep_one_super on public.admin_roles;

create trigger admin_roles_keep_one_super
  before delete or update on public.admin_roles
  for each row execute function public.keep_one_super_admin();

-- ----------------------------------------------------------------------------
-- Nothing else is added here on purpose.
--
-- The staff screen reads `admin_roles` directly (a super admin may already
-- select every row) and maps ids to emails through `admin_customers`, which
-- has existed since 0016. So the screen works whether or not this migration
-- has been applied, and this file is only the safety rail — which is the half
-- that must not be optional.
-- ----------------------------------------------------------------------------
