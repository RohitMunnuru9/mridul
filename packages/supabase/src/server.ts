/**
 * Request-scoped Supabase client for server components and server actions.
 *
 * This is the one that matters for the admin. It carries the signed-in user's
 * session from the cookie, which means row-level security applies *as that
 * user* — an editor's role decides what they may write, enforced by Postgres
 * rather than by the UI hiding a button.
 *
 * Deliberately not the service-role client. Using that here would make every
 * admin write bypass RLS, and the role model would become decoration.
 *
 * Kept in its own entry point because it imports `next/headers`, which must
 * never be pulled into a browser bundle.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@mridul/types';
import type { Client } from './index';

function env(name: 'url' | 'anon'): string {
  const value =
    name === 'url'
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error(
      'Missing Supabase configuration. Copy .env.example to .env.local.',
    );
  }
  return value;
}

export async function sessionClient(): Promise<Client> {
  const store = await cookies();

  return createServerClient<Database>(env('url'), env('anon'), {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            store.set(name, value, options);
          }
        } catch {
          // Server components cannot write cookies. Refreshes still happen in
          // server actions and route handlers, which can — so swallowing this
          // is correct rather than lazy.
        }
      },
    },
  });
}

export type AdminRole =
  | 'super_admin'
  | 'catalog_manager'
  | 'order_manager'
  | 'content_manager'
  | 'support';

export type AdminIdentity = {
  id: string;
  email: string;
  roles: AdminRole[];
};

/**
 * Why a person is or is not an admin.
 *
 * There are four answers and they are not interchangeable. In particular,
 * "your role could not be read" is not "you have no role" — the first is a
 * session that has gone stale, the second is a permission decision. Collapsing
 * them tells a super admin they have been demoted, which is alarming and
 * false, and leaves them with nothing useful to do about it.
 */
export type AdminAccess =
  | { state: 'signed_out' }
  | { state: 'ok'; identity: AdminIdentity }
  /** Signed in, `admin_roles` has nothing for them. A customer account. */
  | { state: 'no_role'; email: string }
  /** Signed in, but the role query itself failed. Almost always an expired
   *  session: the cookie still names them, the token no longer authorises
   *  anything. Signing out and back in fixes it. */
  | { state: 'unreadable'; email: string; reason: string };

export async function adminAccess(): Promise<AdminAccess> {
  const db = await sessionClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { state: 'signed_out' };

  const { data, error } = await db
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id);

  if (error) {
    return { state: 'unreadable', email: user.email ?? '', reason: error.message };
  }

  const roles = (data ?? []).map((row) => row.role as AdminRole);
  if (roles.length === 0) return { state: 'no_role', email: user.email ?? '' };

  return { state: 'ok', identity: { id: user.id, email: user.email ?? '', roles } };
}

/**
 * The signed-in admin, or null.
 *
 * The gate's question, which only has two answers. Anything that wants to
 * explain *why* somebody is not an admin should call `adminAccess` instead.
 */
export async function currentAdmin(): Promise<AdminIdentity | null> {
  const access = await adminAccess();
  return access.state === 'ok' ? access.identity : null;
}

/** super_admin passes every check, as it does in the database policies. */
export function can(identity: AdminIdentity | null, ...allowed: AdminRole[]): boolean {
  if (!identity) return false;
  if (identity.roles.includes('super_admin')) return true;
  return allowed.some((role) => identity.roles.includes(role));
}
