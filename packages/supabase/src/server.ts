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
 * The signed-in admin, or null.
 *
 * Reads `admin_roles` through the user's own session, so a signed-in customer
 * with no admin role gets an empty list and is treated as not an admin.
 */
export async function currentAdmin(): Promise<AdminIdentity | null> {
  const db = await sessionClient();

  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const { data } = await db.from('admin_roles').select('role').eq('user_id', user.id);
  const roles = (data ?? []).map((row) => row.role as AdminRole);
  if (roles.length === 0) return null;

  return { id: user.id, email: user.email ?? '', roles };
}

/** super_admin passes every check, as it does in the database policies. */
export function can(identity: AdminIdentity | null, ...allowed: AdminRole[]): boolean {
  if (!identity) return false;
  if (identity.roles.includes('super_admin')) return true;
  return allowed.some((role) => identity.roles.includes(role));
}
