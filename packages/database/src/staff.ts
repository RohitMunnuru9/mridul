/**
 * Who can administer the shop.
 *
 * `admin_roles` holds user ids and nothing else — the emails live in
 * `auth.users`, which no client role can read. So the list is assembled from
 * two reads the shop already has: the role rows, which only a super admin may
 * select, and `admin_customers`, the SECURITY DEFINER view of accounts that
 * the customers page uses.
 *
 * Deliberately no fallback to a uuid when an email cannot be found. A row of
 * `8963553b-…` in a list of people who can change prices is not information,
 * it is an unanswered question, and the page says so instead.
 */

import type { Client } from '@mridul/supabase';

export type AdminRole =
  | 'super_admin'
  | 'catalog_manager'
  | 'order_manager'
  | 'content_manager'
  | 'support';

export const ADMIN_ROLES: AdminRole[] = [
  'super_admin',
  'catalog_manager',
  'order_manager',
  'content_manager',
  'support',
];

/** What each role means, in the shop's words rather than the enum's. */
export const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: 'Owner',
  catalog_manager: 'Catalogue',
  order_manager: 'Orders',
  content_manager: 'Content',
  support: 'Support',
};

export const ROLE_MEANING: Record<AdminRole, string> = {
  super_admin:
    'Everything, including discount codes and who else can get in. Give this only to someone you would trust with the bank account.',
  catalog_manager: 'Products, photos, stock, categories and collections.',
  order_manager: 'Orders, dispatch and tracking. Cannot change prices.',
  content_manager: 'Homepage, categories copy and anything else customers read.',
  support: 'Can look at orders and customers. Changes nothing.',
};

export type StaffMember = {
  userId: string;
  /** Null when the account behind this role row could not be read. */
  email: string | null;
  fullName: string | null;
  roles: AdminRole[];
  grantedAt: string;
  lastSignInAt: string | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchStaff(db: Client): Promise<StaffMember[]> {
  const [rolesResult, peopleResult] = await Promise.all([
    db.from('admin_roles').select('user_id, role, granted_at'),
    db.rpc('admin_customers'),
  ]);

  if (rolesResult.error) throw new Error(rolesResult.error.message);

  // The account list is a nicety — without it the page still knows who holds
  // what, just not their names — so a failure here is not a failure of the
  // page.
  const people = new Map<string, any>();
  for (const person of (peopleResult.data ?? []) as any[]) {
    people.set(person.id, person);
  }

  const byUser = new Map<string, StaffMember>();
  for (const row of (rolesResult.data ?? []) as any[]) {
    const existing = byUser.get(row.user_id);
    if (existing) {
      existing.roles.push(row.role as AdminRole);
      // The earliest grant is when this person was let in.
      if (row.granted_at < existing.grantedAt) existing.grantedAt = row.granted_at;
      continue;
    }
    const person = people.get(row.user_id);
    byUser.set(row.user_id, {
      userId: row.user_id,
      email: person?.email ?? null,
      fullName: person?.full_name ?? null,
      roles: [row.role as AdminRole],
      grantedAt: row.granted_at,
      lastSignInAt: person?.last_sign_in_at ?? null,
    });
  }

  const staff = [...byUser.values()];
  for (const member of staff) {
    member.roles.sort(
      (a, b) => ADMIN_ROLES.indexOf(a) - ADMIN_ROLES.indexOf(b),
    );
  }
  // Owners first, then by email — the list is read to answer "who has the
  // keys", and that is the answer.
  return staff.sort((a, b) => {
    const owner = Number(b.roles.includes('super_admin')) - Number(a.roles.includes('super_admin'));
    return owner || (a.email ?? '').localeCompare(b.email ?? '');
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Whether taking this role away is safe.
 *
 * The one irreversible mistake this screen makes possible: removing the last
 * owner. After that nobody can grant the role back, because granting it
 * requires being one. The database refuses this too (migration 0022) — this is
 * what stops the button being offered in the first place, so the refusal is
 * not something you discover by pressing it.
 */
export function canRevoke(
  staff: StaffMember[],
  userId: string,
  role: AdminRole,
): { ok: true } | { ok: false; reason: string } {
  if (role !== 'super_admin') return { ok: true };

  const owners = staff.filter((member) => member.roles.includes('super_admin'));
  if (owners.length <= 1 && owners.some((member) => member.userId === userId)) {
    return {
      ok: false,
      reason: 'This is the only owner account. Make someone else an owner first.',
    };
  }
  return { ok: true };
}

/** Roles this person does not already hold. */
export function grantableRoles(member: StaffMember): AdminRole[] {
  return ADMIN_ROLES.filter((role) => !member.roles.includes(role));
}
