'use server';

/**
 * Giving and taking away access to the shop.
 *
 * Only a super admin may write to `admin_roles` — that is the policy in 0001,
 * and it is what actually decides. The checks here exist to refuse in a
 * sentence rather than a Postgres error, and to stop the one mistake that
 * cannot be undone from inside the product: removing the last owner.
 *
 * This deliberately cannot create accounts. Somebody has to have signed in to
 * the shop at least once before they can be given a role, which means the
 * account is theirs, with their own password, rather than one handed round.
 */

import { revalidatePath } from 'next/cache';
import { ADMIN_ROLES, canRevoke, fetchStaff, ROLE_LABEL, type AdminRole } from '@mridul/database';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import type { ActionResult } from './catalogue';
import { audit } from './audit';

const OK = (message: string): ActionResult => ({ ok: true, message });
const FAIL = (message: string): ActionResult => ({ ok: false, message });

function isRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as string[]).includes(value);
}

function readable(message: string): string {
  if (/row-level security|permission denied/i.test(message)) {
    return 'Only the shop owner can change who has access.';
  }
  if (/duplicate key|unique/i.test(message)) {
    return 'They already have that access.';
  }
  return message;
}

/**
 * Give somebody access, by the email they sign in with.
 *
 * The account has to exist already. `admin_customers` is the only view of
 * `auth.users` any client role has, and it is where the email is matched —
 * so an address nobody has ever signed in with is a clear "no such account"
 * rather than a role row pointing at nothing.
 */
export async function grantRole(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin)) return FAIL('Only the shop owner can change who has access.');

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? '');

  if (!email) return FAIL('Enter the email address they sign in with.');
  if (!isRole(role)) return FAIL('Choose what they should be able to do.');

  const db = await sessionClient();

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: people, error: lookupError } = await db.rpc('admin_customers');
  if (lookupError) return FAIL(readable(lookupError.message));

  const person = ((people ?? []) as any[]).find(
    (row) => String(row.email ?? '').toLowerCase() === email,
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!person) {
    return FAIL(
      `Nobody has signed in with ${email} yet. Ask them to sign in to the shop once, then give them access.`,
    );
  }

  const { error } = await db
    .from('admin_roles')
    .insert({ user_id: person.id, role, granted_by: admin?.id ?? null });
  if (error) return FAIL(readable(error.message));

  // Access changes are the entries most worth having. Who let somebody in, and
  // when, is the first question asked after anything goes wrong.
  await audit('access.grant', 'admin_role', person.id, null, { email, role });
  revalidatePath('/staff');
  return OK(`${email} can now handle ${ROLE_LABEL[role].toLowerCase()}.`);
}

/**
 * Take one role away.
 *
 * Refuses to remove the last owner. The database refuses it too once 0022 is
 * applied; this is the half that keeps somebody from finding out by pressing
 * the button.
 */
export async function revokeRole(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin)) return FAIL('Only the shop owner can change who has access.');

  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!userId) return FAIL('That person could not be found.');
  if (!isRole(role)) return FAIL('That is not a kind of access.');

  const db = await sessionClient();

  // Read the current picture rather than trusting what the page was drawn
  // with: the owner may have been removed in another tab since.
  const staff = await fetchStaff(db);
  const allowed = canRevoke(staff, userId, role);
  if (!allowed.ok) return FAIL(allowed.reason);

  const { error } = await db
    .from('admin_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role', role);
  if (error) return FAIL(readable(error.message));

  const who = staff.find((member) => member.userId === userId);
  await audit('access.revoke', 'admin_role', userId, { email: who?.email ?? null, role }, null);
  revalidatePath('/staff');
  return OK('Access removed.');
}
